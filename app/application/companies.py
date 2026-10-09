"""Owner-scoped company research, reused by vacancy and interview workflows."""

from dataclasses import asdict
from typing import Any

from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument
from app.domain.models import Session


class Companies:
    def __init__(self, store: CareerRepository):
        self.store = store

    def list(self, session: Session) -> list[dict[str, Any]]:
        vacancies = self.store.list("vacancy", session.owner)
        return [
            {
                **asdict(c),
                "vacancy_ids": [v.id for v in vacancies if v.data.get("company_id") == c.id],
            }
            for c in self.store.list("company", session.owner)
        ]

    def save(
        self,
        session: Session,
        data: dict[str, Any],
        record_id: str | None = None,
        revision: int = 0,
    ) -> CareerRecord:
        if record_id:
            current = self.store.get("company", session.owner, record_id)
            if current.revision != revision:
                raise Conflict
        key = " ".join(data["name"].casefold().split())
        if not key:
            raise InvalidDocument("Enter a company name.")
        if any(
            c.id != record_id and " ".join(c.data["name"].casefold().split()) == key
            for c in self.store.list("company", session.owner)
        ):
            raise InvalidDocument(
                "This company is already in your catalog.", code="duplicate_company"
            )
        data["skills"] = list({s.casefold(): s for s in data["skills"] if s.strip()}.values())
        return (
            self.store.update("company", session.owner, record_id, revision, data)
            if record_id
            else self.store.create("company", session, data)
        )
