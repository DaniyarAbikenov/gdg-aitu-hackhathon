"""Text interview practice: generated questions, evaluated answers, history."""

from typing import Any

from app.application.ports import SessionStore
from app.application.profile import ProfileService
from app.domain.career import CareerCoach, CareerRepository
from app.domain.errors import Conflict
from app.domain.interview import Interview
from app.domain.models import Session

COMPANY_RESEARCH = {"skills": [], "assignments": [], "hiring_process": ""}


class InterviewService:
    def __init__(
        self,
        store: CareerRepository,
        sessions: SessionStore,
        coach: CareerCoach,
        profiles: ProfileService,
    ):
        self.store, self.sessions = store, sessions
        self.coach, self.profiles = coach, profiles

    def load(self, session: Session, interview_id: str) -> Interview:
        return Interview.from_record(self.store.get("interview", session.owner, interview_id))

    def save(self, session: Session, interview: Interview, revision: int) -> Interview:
        record = self.store.update(
            "interview", session.owner, interview.id, revision, interview.to_data()
        )
        return Interview.from_record(record)

    def history(self, session: Session) -> list[dict[str, Any]]:
        return [
            Interview.from_record(r).public() for r in self.store.list("interview", session.owner)
        ]

    def get(self, session: Session, interview_id: str) -> dict[str, Any]:
        return self.load(session, interview_id).public()

    def start(self, session: Session, context: dict[str, Any]) -> dict[str, Any]:
        self.sessions.consume_analysis(session)
        if context.get("vacancy_id"):
            self.store.get("vacancy", session.owner, context["vacancy_id"])
        if context.get("company_id"):
            company = self.store.get("company", session.owner, context["company_id"])
            context = {
                **context,
                "company_research": {
                    k: company.data.get(k, default) for k, default in COMPANY_RESEARCH.items()
                },
            }
        if context.get("mode") == "voice":
            # Voice questions come from the live conversation, not a generated list.
            data = Interview.new_data(context, "openai", [])
        else:
            generated = self.coach.questions({**context, "profile": self.profiles.data(session)})
            data = Interview.new_data(context, generated["provider"], generated["questions"])
        return Interview.from_record(self.store.create("interview", session, data)).public()

    def answer(
        self, session: Session, interview_id: str, revision: int, answer: str
    ) -> dict[str, Any]:
        interview = self.load(session, interview_id)
        interview.require_open(revision)
        if interview.is_voice:
            raise Conflict
        question = interview.current_question()
        self.sessions.consume_analysis(session)
        interview.record_answer(answer, self.coach.evaluate(interview.context, question, answer))
        return self.save(session, interview, revision).public()

    def delete(self, session: Session, interview_id: str) -> None:
        self.store.delete("interview", session.owner, interview_id)
