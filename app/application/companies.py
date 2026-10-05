"""Owner-scoped company research, reused by vacancy and interview workflows."""

from dataclasses import asdict

from app.domain.errors import Conflict, InvalidDocument


class Companies:
    def __init__(self, store):
        self.store = store

    def list(self, session):
        vacancies = self.store.list("vacancy", session.owner)
        return [
            {
                **asdict(c),
                "vacancy_ids": [v.id for v in vacancies if v.data.get("company_id") == c.id],
            }
            for c in self.store.list("company", session.owner)
        ]

    def save(self, session, data, record_id=None, revision=0):
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
            raise InvalidDocument("This company is already in your catalog.")
        data["skills"] = list({s.casefold(): s for s in data["skills"] if s.strip()}.values())
        return (
            self.store.update("company", session.owner, record_id, revision, data)
            if record_id
            else self.store.create("company", session, data)
        )
