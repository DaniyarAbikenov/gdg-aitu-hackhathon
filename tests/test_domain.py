"""Domain rules run without PostgreSQL, Redis or HTTP."""

import pytest

from app.domain.career import CareerRecord
from app.domain.errors import Conflict, InvalidDocument, NotFound
from app.domain.interview import MAX_TRANSCRIPT_TURNS, Interview
from app.domain.learning import LearningPlan
from app.domain.progress import average, milestones
from app.domain.vacancy import company_key, next_step

QUESTION = {"question": "Why?", "reference_answer": "Because.", "criteria": ["clarity"]}


def record(kind, data, revision=1):
    del kind  # Records do not carry their kind; the name documents the fixture.
    return CareerRecord(id="r1", revision=revision, data=data, created_at="2026-01-01")


def text_interview(questions=2):
    data = Interview.new_data({"mode": "text"}, "local", [QUESTION] * questions)
    return Interview.from_record(record("interview", data))


def test_interview_scores_only_after_the_last_answer():
    interview = text_interview()
    assert interview.public()["question"] == "Why?"
    assert "reference_answer" not in str(interview.public())

    interview.record_answer("first", {"score": 60, "improvements": []})
    assert not interview.finished and interview.score is None

    interview.record_answer("second", {"score": 81, "improvements": []})
    assert interview.finished and interview.score == 70
    assert interview.public()["question"] is None
    with pytest.raises(Conflict):
        interview.require_open(interview.revision)


def test_interview_rejects_a_stale_revision():
    with pytest.raises(Conflict):
        text_interview().require_open(0)


def test_interview_keeps_fields_from_older_releases():
    data = {**Interview.new_data({}, "local", [QUESTION]), "legacy": True}
    assert Interview.from_record(record("interview", data)).to_data()["legacy"] is True


def test_voice_transcript_merges_turns_and_needs_a_user_answer():
    data = Interview.new_data({"mode": "voice"}, "openai", [])
    interview = Interview.from_record(record("interview", data))
    interview.add_turns([{"id": "1", "role": "assistant", "text": "Hi"}])
    interview.add_turns([{"id": "1", "role": "assistant", "text": "Hi"}])
    assert len(interview.transcript) == 1
    with pytest.raises(InvalidDocument):
        interview.transcript_text()

    interview.add_turns([{"id": "2", "role": "user", "text": "Hello"}])
    interview.finish_voice({"score": 77, "improvements": []})
    assert interview.finished and interview.score == 77
    assert interview.answers[0]["answer"] == "Hello"


def test_voice_transcript_has_a_length_limit():
    interview = Interview.from_record(record("interview", Interview.new_data({}, "openai", [])))
    turns = [{"id": str(i), "role": "user", "text": "x"} for i in range(MAX_TRANSCRIPT_TURNS + 1)]
    with pytest.raises(InvalidDocument):
        interview.add_turns(turns)


def test_learning_plan_tracks_module_completion():
    module = {
        "id": "1",
        "title": "SQL",
        "hours": 4,
        "goals": ["Joins"],
        "exercise": "Write a report",
        "resource_topic": "PostgreSQL",
        "completed": False,
        "evidence": "",
    }
    plan = LearningPlan.from_record(
        record(
            "plan", {"goal": "Data", "explanation": "Why", "provider": "local", "modules": [module]}
        )
    )
    plan.update_module("1", True, "repo link")
    assert plan.completed_modules == 1
    assert "Evidence: repo link" in plan.as_text()
    with pytest.raises(NotFound):
        plan.update_module("9", True, "")


def test_milestones_follow_saved_activity():
    available = {m.key: m.available for m in milestones(5, 70, 3)}
    assert available == {"first-step": True, "interview": True, "resume": True, "persistence": True}
    assert not any(m.available for m in milestones(0, None, 0))
    assert average([]) is None and average([70, 81]) == 76


@pytest.mark.parametrize(
    ("status", "action", "resume", "started", "finished", "plans", "key"),
    [
        ("offer", "call", True, 1, 1, 1, "wrapUp"),
        ("saved", "Call Anna", False, 0, 0, 0, "custom"),
        ("saved", "", False, 0, 0, 0, "chooseResume"),
        ("saved", "", True, 0, 0, 0, "practice"),
        ("saved", "", True, 1, 0, 0, "finish"),
        ("saved", "", True, 1, 1, 0, "plan"),
        ("applied", "", True, 1, 1, 1, "contact"),
    ],
)
def test_vacancy_next_step(status, action, resume, started, finished, plans, key):
    assert next_step(status, action, resume, started, finished, plans).key == key


def test_company_identity_ignores_case_and_spacing():
    assert company_key("  Kaspi   Bank ") == company_key("kaspi bank")
