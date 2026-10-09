"""Career use cases coordinate ports; all state is persisted externally."""

import json
from collections.abc import Sequence
from dataclasses import asdict
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.application.ports import ResumeRepository, SessionStore
from app.domain.career import CareerCoach, CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument, NotFound
from app.domain.models import ResumeFields, ResumeRecord, Session
from app.domain.review import compare

DELETABLE = {"plan", "interview", "version"}
DEFAULT_WIDGETS = ("resumes", "skills", "companies", "learning", "activity", "journey")


class CareerService:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        coach: CareerCoach,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.coach = coach

    def profile(self, session: Session) -> CareerRecord | None:
        try:
            return self.store.get("profile", session.owner, session.owner)
        except NotFound:
            return None

    def save_profile(self, session: Session, data: dict[str, Any], revision: int) -> CareerRecord:
        old = self.profile(session)
        if old:
            return self.store.update("profile", session.owner, session.owner, revision, data)
        if revision != 0:
            raise Conflict
        return self.store.create("profile", session, data, session.owner)

    def profile_data(self, session: Session) -> dict[str, Any]:
        profile = self.profile(session)
        return profile.data if profile else {}

    def adapt(self, session: Session, resume_id: str, revision: int, job: str) -> dict[str, Any]:
        resume = self.resumes.get(session.owner, resume_id)
        if resume.revision != revision:
            raise Conflict
        self.sessions.consume_analysis(session)
        result = self.coach.improvements(asdict(resume.fields), self.profile_data(session), job)
        assessment = {
            "resume_id": resume_id,
            "resume_revision": revision,
            "missing_skills": compare(resume.fields, job).missing_skills,
            "job": job,
            "improvements": result["improvements"],
        }
        previous = next(
            (
                a
                for a in self.store.list("assessment", session.owner)
                if a.data["resume_id"] == resume_id
            ),
            None,
        )
        if previous:
            self.store.update(
                "assessment", session.owner, previous.id, previous.revision, assessment
            )
        else:
            self.store.create(
                "assessment",
                session,
                assessment,
                str(uuid5(NAMESPACE_URL, session.owner + ":assessment:" + resume_id)),
            )
        return {**result, "revision": revision, "jd_text": job}

    def apply_proposal(
        self, session: Session, resume_id: str, revision: int, proposal_id: str
    ) -> CareerRecord:
        resume = self.resumes.get(session.owner, resume_id)
        assessment = next(
            (
                a
                for a in self.store.list("assessment", session.owner)
                if a.data["resume_id"] == resume_id
            ),
            None,
        )
        if (
            resume.revision != revision
            or not assessment
            or assessment.data["resume_revision"] != revision
        ):
            raise Conflict
        proposal = next(
            (p for p in assessment.data["improvements"] if p["id"] == proposal_id), None
        )
        if not proposal:
            raise NotFound
        fields = asdict(resume.fields)
        value = proposal["after"]
        if proposal["section"] == "skills":
            value = [v.strip() for v in value.split(",") if v.strip()]
        elif isinstance(fields[proposal["section"]], list):
            try:
                value = json.loads(value)
            except ValueError as exc:
                raise InvalidDocument(
                    "The suggested section is invalid. Request a new analysis."
                ) from exc
        fields[proposal["section"]] = value
        remaining = {
            **assessment.data,
            "resume_revision": revision + 1,
            "missing_skills": compare(
                ResumeFields(**fields), assessment.data["job"]
            ).missing_skills,
            "improvements": [
                p for p in assessment.data["improvements"] if p["section"] != proposal["section"]
            ],
        }
        return self.store.apply_proposal(
            session,
            resume_id,
            revision,
            assessment.id,
            assessment.revision,
            fields,
            remaining,
            proposal["section"],
        )

    def save_version(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        fields: dict[str, Any],
        label: str,
        job: str,
    ) -> CareerRecord:
        # Version creation does not overwrite the source resume. A later restore is a separate CAS operation.
        original = self.resumes.get(session.owner, resume_id)
        if original.revision != revision:
            raise Conflict
        return self.store.create(
            "version",
            session,
            {
                "resume_id": resume_id,
                "label": label,
                "fields": fields,
                "before": asdict(original.fields),
                "jd_text": job,
            },
        )

    def restore_version(self, session: Session, version_id: str, revision: int) -> ResumeRecord:
        version = self.store.get("version", session.owner, version_id)
        return self.resumes.save(
            session.owner,
            version.data["resume_id"],
            revision,
            ResumeFields(**version.data["fields"]),
        )

    def start_interview(self, session: Session, context: dict[str, Any]) -> CareerRecord:
        self.sessions.consume_analysis(session)
        for kind in ["company", "vacancy"]:
            if context.get(kind + "_id"):
                record = self.store.get(kind, session.owner, context[kind + "_id"])
                if kind == "company":
                    context = {
                        **context,
                        "company_research": {
                            k: record.data.get(k, [] if k in {"skills", "assignments"} else "")
                            for k in ["skills", "assignments", "hiring_process"]
                        },
                    }
        if context.get("mode") == "voice":
            return self.store.create(
                "interview",
                session,
                {
                    "provider": "openai",
                    "context": context,
                    "questions": [],
                    "answers": [],
                    "transcript": [],
                    "finished": False,
                    "score": None,
                },
            )
        generated = self.coach.questions({**context, "profile": self.profile_data(session)})
        return self.store.create(
            "interview",
            session,
            {**generated, "context": context, "answers": [], "finished": False, "score": None},
        )

    def public_interview(self, record: CareerRecord) -> dict[str, Any]:
        data = record.data
        index = len(data["answers"])
        return {
            "id": record.id,
            "revision": record.revision,
            "created_at": record.created_at,
            "context": data["context"],
            "provider": data["provider"],
            "answers": data["answers"],
            "finished": data["finished"],
            "score": data["score"],
            "total_questions": len(data["questions"]),
            "question": None
            if data["finished"] or not data["questions"]
            else data["questions"][index]["question"],
            "transcript": data.get("transcript", []),
        }

    def answer(
        self, session: Session, interview_id: str, revision: int, answer: str
    ) -> CareerRecord:
        record = self.store.get("interview", session.owner, interview_id)
        if (
            record.revision != revision
            or record.data["finished"]
            or record.data["context"].get("mode") == "voice"
        ):
            raise Conflict
        data = record.data
        question = data["questions"][len(data["answers"])]
        self.sessions.consume_analysis(session)
        evaluation = self.coach.evaluate(data["context"], question, answer)
        data["answers"].append(
            {
                "question": question["question"],
                "answer": answer,
                "reference_answer": question["reference_answer"],
                "criteria": question["criteria"],
                **evaluation,
            }
        )
        data["finished"] = len(data["answers"]) == len(data["questions"])
        if data["finished"]:
            data["score"] = round(sum(a["score"] for a in data["answers"]) / len(data["answers"]))
        return self.store.update("interview", session.owner, interview_id, revision, data)

    def create_plan(
        self,
        session: Session,
        goal: str,
        resume_id: str | None = None,
        interview_id: str | None = None,
        position: str = "",
        stacks: list[str] | None = None,
        vacancy_id: str | None = None,
    ) -> CareerRecord:
        gaps = []
        vacancy = self.store.get("vacancy", session.owner, vacancy_id).data if vacancy_id else {}
        if vacancy_id and not resume_id:
            resume_id = vacancy.get("resume_id") or None
        if vacancy_id and not interview_id:
            interview_id = next(
                (
                    i.id
                    for i in self.store.list("interview", session.owner)
                    if i.data["context"].get("vacancy_id") == vacancy_id and i.data["finished"]
                ),
                None,
            )
        if resume_id:
            resume = self.resumes.get(session.owner, resume_id)
            assessment = next(
                (
                    a
                    for a in self.store.list("assessment", session.owner)
                    if a.data["resume_id"] == resume_id
                    and a.data["resume_revision"] == resume.revision
                ),
                None,
            )
            if assessment:
                gaps += assessment.data["missing_skills"]
            elif resume.analysis:
                gaps += resume.analysis.missing_skills
        if interview_id:
            interview = self.store.get("interview", session.owner, interview_id)
            for answer in interview.data["answers"]:
                gaps += answer["improvements"]
        self.sessions.consume_analysis(session)
        plan = self.coach.plan(
            {
                **self.profile_data(session),
                "vacancy": vacancy,
                "target_position": position,
                "preferred_stacks": stacks or [],
            },
            goal,
            gaps[:20],
        )
        plan.update(
            resume_id=resume_id,
            interview_id=interview_id,
            position=position,
            stacks=stacks or [],
            vacancy_id=vacancy_id,
        )
        return self.store.create("plan", session, plan)

    def complete_module(
        self,
        session: Session,
        plan_id: str,
        module_id: str,
        revision: int,
        completed: bool,
        evidence: str,
    ) -> CareerRecord:
        plan = self.store.get("plan", session.owner, plan_id)
        module = next((m for m in plan.data["modules"] if m["id"] == module_id), None)
        if not module:
            raise NotFound
        module.update(completed=completed, evidence=evidence)
        return self.store.update("plan", session.owner, plan_id, revision, plan.data)

    def progress(self, session: Session) -> dict[str, Any]:
        plans = self.store.list("plan", session.owner)
        interviews = self.store.list("interview", session.owner)
        versions = self.store.list("version", session.owner)
        modules = [m for p in plans for m in p.data["modules"]]
        completed = sum(m["completed"] for m in modules)
        scores = [i.data["score"] for i in interviews if i.data["finished"]]
        earned = {r.data["key"] for r in self.store.list("reward", session.owner)}
        requirements = [
            ("first-step", "First step", completed >= 1),
            ("interview", "Interview practice", bool(scores) and max(scores) >= 70),
            ("resume", "Resume explorer", len(versions) >= 3),
            ("persistence", "Persistence", completed >= 5),
        ]
        return {
            "completed_modules": completed,
            "total_modules": len(modules),
            "interviews_completed": len(scores),
            "average_score": round(sum(scores) / len(scores)) if scores else None,
            "resume_versions": len(versions),
            "resumes": len(self.resumes.list(session.owner)),
            "rewards": [
                {"key": k, "title": t, "available": a, "claimed": k in earned}
                for k, t, a in requirements
            ],
        }

    def claim_reward(self, session: Session, key: str) -> CareerRecord:
        reward = next((r for r in self.progress(session)["rewards"] if r["key"] == key), None)
        if not reward or not reward["available"]:
            raise InvalidDocument("Complete the milestone before claiming it.")
        if reward["claimed"]:
            raise Conflict
        # Stable ID makes concurrent claims unique.
        return self.store.create(
            "reward", session, {"key": key}, str(uuid5(NAMESPACE_URL, session.owner + key))
        )

    def interviews(self, session: Session) -> list[dict[str, Any]]:
        return [self.public_interview(r) for r in self.store.list("interview", session.owner)]

    def interview(self, session: Session, interview_id: str) -> dict[str, Any]:
        return self.public_interview(self.store.get("interview", session.owner, interview_id))

    def plans(self, session: Session) -> list[CareerRecord]:
        return self.store.list("plan", session.owner)

    def plan_text(self, session: Session, plan_id: str) -> str:
        plan = self.store.get("plan", session.owner, plan_id).data
        lines = [plan["goal"], plan["explanation"], f"Provider: {plan['provider']}"]
        for week in plan["modules"]:
            lines += [
                f"\nWeek {week['id']}: {week['title']} ({week['hours']} hours)",
                *week["goals"],
                week["exercise"],
                "Resource topic: " + week["resource_topic"],
                "Completed: " + str(week["completed"]),
                "Evidence: " + week["evidence"],
            ]
        return "\n".join(lines)

    def delete(self, session: Session, kind: str, record_id: str) -> None:
        if kind not in DELETABLE:
            raise NotFound
        self.store.delete(kind, session.owner, record_id)

    def preferences(self, session: Session) -> CareerRecord | dict[str, Any]:
        try:
            return self.store.get("preferences", session.owner, session.owner)
        except NotFound:
            return {"revision": 0, "data": {"widgets": list(DEFAULT_WIDGETS)}}

    def save_preferences(
        self, session: Session, widgets: Sequence[str], revision: int
    ) -> CareerRecord:
        data = {"widgets": list(dict.fromkeys(widgets))}
        if revision:
            return self.store.update("preferences", session.owner, session.owner, revision, data)
        return self.store.create("preferences", session, data, session.owner)

    def targets(self, session: Session, kind: str) -> list[CareerRecord]:
        return self.store.list(kind, session.owner)

    def save_target(self, session: Session, kind: str, data: dict[str, Any]) -> CareerRecord:
        if data.get("company_id"):
            self.store.get("company", session.owner, data["company_id"])
        return self.store.create(kind, session, data)
