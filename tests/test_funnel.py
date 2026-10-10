from datetime import UTC, datetime, timedelta

from app.domain import funnel
from app.domain.vacancy import next_step

NOW = datetime(2026, 10, 14, 12, tzinfo=UTC)  # a Wednesday


def ago(days):
    return (NOW - timedelta(days=days)).isoformat()


def vacancy(status, **stages):
    return {"status": status, "stages": {k: ago(v) for k, v in stages.items()}}


def test_stage_dates_keep_the_first_time_a_status_was_reached():
    stages = funnel.record_stage(None, "applied", "t1")
    stages = funnel.record_stage(stages, "interview", "t2")
    assert funnel.record_stage(stages, "applied", "t3") == {"applied": "t1", "interview": "t2"}
    assert funnel.record_stage(stages, "archived", "t4") == stages


def test_furthest_stage_survives_a_rejection():
    rejected = vacancy("rejected", applied=10, interview=5, rejected=1)
    assert funnel.reached(rejected) == "interview"
    assert funnel.rejection_stage(rejected) == "interview"
    # Records from earlier releases have no dates; the candidate's answer fills the gap.
    legacy = {"status": "rejected", "rejection": {"stage": "interview", "reason": "technical"}}
    assert funnel.reached(legacy) == "interview"
    assert funnel.rejection_stage({"status": "rejected"}) == "applied"


def test_funnel_counts_and_conversion_between_stages():
    vacancies = [
        vacancy("saved"),
        vacancy("applied", applied=3),
        vacancy("rejected", applied=9, rejected=2),
        vacancy("interview", applied=8, interview=2),
        vacancy("offer", applied=20, interview=15, offer=1),
    ]
    result = funnel.summary(vacancies, [], NOW)
    assert [(s["stage"], s["count"], s["rate"]) for s in result["stages"]] == [
        ("saved", 5, None),
        ("applied", 4, 0.8),
        ("interview", 2, 0.5),
        ("offer", 1, 0.5),
    ]
    assert result["active"] == 3
    assert result["rejections"]["by_stage"] == [
        {"stage": "applied", "count": 1},
        {"stage": "interview", "count": 0},
    ]
    assert funnel.summary([], [], NOW)["stages"][1]["rate"] is None


def test_weekly_effort_uses_local_weeks():
    events = [
        {"kind": "interview_completed", "at": ago(1)},
        {"kind": "module_completed", "at": ago(1)},
        {"kind": "module_completed", "at": ago(9)},
        {"kind": "resume_created", "at": ago(1)},
    ]
    result = funnel.summary([vacancy("applied", applied=0)], events, NOW)
    weeks = result["effort"]
    assert len(weeks) == 8 and weeks[-1]["week"] == "2026-10-12T00:00:00+00:00"
    assert (weeks[-1]["applications"], weeks[-1]["practice"], weeks[-1]["modules"]) == (1, 1, 1)
    assert weeks[-2]["modules"] == 1
    # Monday 00:30 in UTC+5 is still Sunday in UTC, but it belongs to the new local week.
    shifted = funnel.summary([], [], NOW, offset_minutes=300)
    assert shifted["effort"][-1]["week"] == "2026-10-11T19:00:00+00:00"


def test_rejection_reasons_lead_to_one_concrete_step():
    assert funnel.next_action({"reason": "no_reply"})["key"] == "tailorResume"
    assert funnel.next_action({"reason": "technical", "topics": ["SQL"]}) == {
        "key": "studyTopics",
        "topics": ["SQL"],
    }
    assert funnel.next_action({"reason": "assignment"})["key"] == "practiceTechnical"
    assert funnel.next_action({"reason": "behavioral"})["key"] == "practiceStory"
    assert funnel.next_action({"reason": "salary"})["key"] == "checkSalary"
    assert funnel.next_action({"reason": "position_closed"})["key"] == "keepGoing"


def test_feedback_describes_effort_and_patterns_only():
    rejected = [
        {**vacancy("rejected", applied=12), "rejection": {"reason": r, "created_at": ago(1)}}
        for r in ("no_reply", "no_reply", "position_closed")
    ]
    rejected.append(vacancy("rejected", applied=30))
    vacancies = [*rejected, vacancy("interview", applied=9, interview=8)]
    insights = {i["key"]: i["params"] for i in funnel.summary(vacancies, [], NOW)["insights"]}
    assert insights["pattern"] == {"reason": "no_reply", "count": 2, "total": 3}
    assert insights["outside"] == {"count": 1}
    assert insights["reviewed"] == {"count": 3}
    assert insights["unreviewed"] == {"count": 1}
    assert insights["interviews"] == {"count": 1}
    # Applications one and two weeks ago, nothing yet this week.
    assert insights["streak"] == {"weeks": 2}
    assert "thisWeek" not in insights and insights["restart"] == {}


def test_quiet_week_after_active_one_suggests_a_restart():
    insights = funnel.summary([vacancy("applied", applied=7)], [], NOW)["insights"]
    assert [i["key"] for i in insights] == ["restart"]
    busy = funnel.summary([vacancy("applied", applied=1)], [], NOW)["insights"]
    assert busy[0] == {
        "key": "thisWeek",
        "params": {"applications": 1, "practice": 0, "modules": 0},
    }


def test_unreviewed_rejection_asks_for_the_survey():
    assert next_step("rejected", "", True, 1, 1, 1, rejection_reviewed=False).key == (
        "reviewRejection"
    )
    assert next_step("rejected", "", True, 1, 1, 1).key == "wrapUp"
