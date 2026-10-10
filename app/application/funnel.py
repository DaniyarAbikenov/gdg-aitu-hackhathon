"""Application funnel and rejection reviews built from the candidate's own records."""

from datetime import UTC, datetime
from typing import Any

from app.application.ports import ActivityLog
from app.domain import funnel
from app.domain.career import CareerRepository
from app.domain.errors import Conflict, InvalidDocument
from app.domain.models import Session
from app.domain.vacancy import VACANCY_DEFAULTS


class JobSearch:
    def __init__(self, store: CareerRepository, activity: ActivityLog):
        self.store, self.activity = store, activity

    def funnel(self, session: Session, offset_minutes: int = 0) -> dict[str, Any]:
        vacancies = [
            {**VACANCY_DEFAULTS, **r.data} for r in self.store.list("vacancy", session.owner)
        ]
        return funnel.summary(
            vacancies, self.activity.list(session.owner), datetime.now(UTC), offset_minutes
        )

    def review_rejection(
        self,
        session: Session,
        vacancy_id: str,
        revision: int,
        answers: dict[str, Any],
    ) -> dict[str, Any]:
        """Save the short survey and return the one next step it leads to."""
        record = self.store.get("vacancy", session.owner, vacancy_id)
        if record.revision != revision:
            raise Conflict
        data = {**VACANCY_DEFAULTS, **record.data}
        if data["status"] != "rejected":
            raise InvalidDocument("Mark the application as rejected first.", code="not_rejected")
        previous = data.get("rejection") or {}
        rejection = {
            **answers,
            "stage": answers.get("stage") or funnel.rejection_stage(data),
            "created_at": previous.get("created_at") or datetime.now(UTC).isoformat(),
        }
        saved = self.store.update(
            "vacancy", session.owner, vacancy_id, revision, {**record.data, "rejection": rejection}
        )
        return {
            "revision": saved.revision,
            "rejection": rejection,
            "next_action": funnel.next_action(rejection),
        }
