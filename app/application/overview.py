from collections import Counter
from datetime import UTC, datetime, timedelta


class Overview:
    def __init__(self, career, activity):
        self.career, self.activity = career, activity

    def summary(self, session, offset_minutes=0):
        progress = self.career.progress(session)
        resumes = self.career.resumes.list(session.owner)
        interviews = self.career.store.list("interview", session.owner)
        events = self.activity.list(session.owner)
        local_now = datetime.now(UTC) + timedelta(minutes=offset_minutes)
        monday = (local_now - timedelta(days=local_now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(minutes=offset_minutes)
        previous = monday - timedelta(days=7)
        now_week = [e for e in events if datetime.fromisoformat(e["at"]) >= monday]
        last_week = [e for e in events if previous <= datetime.fromisoformat(e["at"]) < monday]

        def learning(items):
            return sum(e["kind"] == "module_completed" for e in items)

        weights = {
            "resume_created": 10,
            "resume_reviewed": 20,
            "version_created": 5,
            "interview_completed": 50,
            "module_completed": 25,
        }
        xp = sum(weights.get(e["kind"], 0) for e in events)
        days = Counter(
            (datetime.fromisoformat(e["at"]) + timedelta(minutes=offset_minutes)).date().isoformat()
            for e in events
        )
        streak = 0
        cursor = local_now.date()
        if cursor.isoformat() not in days:
            cursor -= timedelta(days=1)
        while cursor.isoformat() in days:
            streak += 1
            cursor -= timedelta(days=1)
        assessments = self.career.store.list("assessment", session.owner)
        latest = {}
        for assessment in assessments:
            latest.setdefault(assessment.data["resume_id"], assessment.data)
        gaps = Counter()
        for resume in resumes:
            if resume.lifecycle == "archived":
                continue
            assessment = latest.get(resume.resume_id)
            if assessment and assessment["resume_revision"] == resume.revision:
                gaps.update(set(assessment["missing_skills"]))
            elif resume.analysis:
                gaps.update(set(resume.analysis.missing_skills))
        return {
            **progress,
            "goal": self.career.profile_data(session).get("career_goal", ""),
            "reviewed_resumes": len(
                {r.resume_id for r in resumes if r.status == "reviewed"}
                | (set(latest) & {r.resume_id for r in resumes})
            ),
            "active_resumes": sum(r.lifecycle == "active" for r in resumes),
            "archived_resumes": sum(r.lifecycle == "archived" for r in resumes),
            "skill_gaps": [{"name": k, "mentions": v} for k, v in gaps.most_common(12)],
            "companies": sorted(
                {
                    i.data["context"].get("company_name")
                    or i.data["context"]["company_description"][:120]
                    for i in interviews
                }
            ),
            "week": {
                "current": len(now_week),
                "previous": len(last_week),
                "learning_current": learning(now_week),
                "learning_previous": learning(last_week),
            },
            "activity": [
                {
                    "date": (local_now.date() - timedelta(days=i)).isoformat(),
                    "count": days[(local_now.date() - timedelta(days=i)).isoformat()],
                }
                for i in range(13, -1, -1)
            ],
            "recent": events[:10],
            "xp": xp,
            "level": xp // 100 + 1,
            "level_progress": xp % 100,
            "streak": streak,
            "tracking_started": events[-1]["at"] if events else None,
        }
