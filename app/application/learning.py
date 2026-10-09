"""Learning plans generated from the profile, vacancy gaps and interview feedback."""

from datetime import date, timedelta

from app.application.calendar import CalendarEvent, calendar
from app.application.ports import ResumeRepository, SessionStore
from app.application.profile import ProfileService
from app.domain.career import CareerCoach, CareerRecord, CareerRepository
from app.domain.interview import Interview
from app.domain.learning import LearningPlan
from app.domain.models import Session

MAX_GAPS = 20


class LearningService:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        coach: CareerCoach,
        profiles: ProfileService,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.coach, self.profiles = coach, profiles

    def plans(self, session: Session) -> list[CareerRecord]:
        return self.store.list("plan", session.owner)

    def create(
        self,
        session: Session,
        goal: str,
        resume_id: str | None = None,
        interview_id: str | None = None,
        position: str = "",
        stacks: list[str] | None = None,
        vacancy_id: str | None = None,
    ) -> CareerRecord:
        vacancy = self.store.get("vacancy", session.owner, vacancy_id).data if vacancy_id else {}
        if vacancy_id and not resume_id:
            resume_id = vacancy.get("resume_id") or None
        if vacancy_id and not interview_id:
            interview_id = self.finished_interview_for(session, vacancy_id)
        gaps = self.resume_gaps(session, resume_id) + self.interview_gaps(session, interview_id)
        self.sessions.consume_analysis(session)
        plan = self.coach.plan(
            {
                **self.profiles.data(session),
                "vacancy": vacancy,
                "target_position": position,
                "preferred_stacks": stacks or [],
            },
            goal,
            gaps[:MAX_GAPS],
        )
        plan.update(
            resume_id=resume_id,
            interview_id=interview_id,
            position=position,
            stacks=stacks or [],
            vacancy_id=vacancy_id,
        )
        return self.store.create("plan", session, plan)

    def finished_interview_for(self, session: Session, vacancy_id: str) -> str | None:
        return next(
            (
                i.id
                for i in self.store.list("interview", session.owner)
                if i.data["context"].get("vacancy_id") == vacancy_id and i.data["finished"]
            ),
            None,
        )

    def resume_gaps(self, session: Session, resume_id: str | None) -> list[str]:
        """Missing skills from the assessment of the resume's current revision."""
        if not resume_id:
            return []
        resume = self.resumes.get(session.owner, resume_id)
        for assessment in self.store.list("assessment", session.owner):
            data = assessment.data
            if data["resume_id"] == resume_id and data["resume_revision"] == resume.revision:
                return list(data["missing_skills"])
        return list(resume.analysis.missing_skills) if resume.analysis else []

    def interview_gaps(self, session: Session, interview_id: str | None) -> list[str]:
        if not interview_id:
            return []
        interview = Interview.from_record(self.store.get("interview", session.owner, interview_id))
        return [gap for answer in interview.answers for gap in answer["improvements"]]

    def complete_module(
        self,
        session: Session,
        plan_id: str,
        module_id: str,
        revision: int,
        completed: bool,
        evidence: str,
    ) -> CareerRecord:
        plan = LearningPlan.from_record(self.store.get("plan", session.owner, plan_id))
        plan.update_module(module_id, completed, evidence)
        return self.store.update("plan", session.owner, plan_id, revision, plan.to_data())

    def as_text(self, session: Session, plan_id: str) -> str:
        return LearningPlan.from_record(self.store.get("plan", session.owner, plan_id)).as_text()

    def delete(self, session: Session, plan_id: str) -> None:
        self.store.delete("plan", session.owner, plan_id)

    def calendar(self, session: Session, plan_id: str, start: date) -> str:
        """One all-day reminder at the start of each plan week."""
        plan = LearningPlan.from_record(self.store.get("plan", session.owner, plan_id))
        events = [
            CalendarEvent(
                uid=f"{plan.id}-week-{index}@career-studio",
                day=start + timedelta(weeks=index),
                summary=f"Week {module['id']}: {module['title']}",
                description="\n".join([*module["goals"], module["exercise"]]),
            )
            for index, module in enumerate(plan.modules)
        ]
        return calendar(plan.data["goal"], events)
