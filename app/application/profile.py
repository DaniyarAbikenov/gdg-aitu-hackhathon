"""The candidate's confirmed profile and dashboard preferences."""

from collections.abc import Sequence
from typing import Any

from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, NotFound
from app.domain.models import Session

DEFAULT_WIDGETS = ("resumes", "skills", "companies", "learning", "activity", "journey")


class ProfileService:
    def __init__(self, store: CareerRepository):
        self.store = store

    def get(self, session: Session) -> CareerRecord | None:
        try:
            return self.store.get("profile", session.owner, session.owner)
        except NotFound:
            return None

    def data(self, session: Session) -> dict[str, Any]:
        profile = self.get(session)
        return profile.data if profile else {}

    def save(self, session: Session, data: dict[str, Any], revision: int) -> CareerRecord:
        if self.get(session):
            return self.store.update("profile", session.owner, session.owner, revision, data)
        if revision != 0:
            raise Conflict
        return self.store.create("profile", session, data, session.owner)

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
