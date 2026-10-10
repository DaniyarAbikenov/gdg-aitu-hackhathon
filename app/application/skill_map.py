"""Skill and gap map assembled from the candidate's own records."""

from typing import Any

from app.domain import skill_map
from app.domain.career import CareerRepository
from app.domain.errors import NotFound
from app.domain.models import Session
from app.domain.vacancy import VACANCY_DEFAULTS


class SkillMapService:
    def __init__(self, store: CareerRepository):
        self.store = store

    def map(self, session: Session) -> dict[str, Any]:
        try:
            profile = self.store.get("profile", session.owner, session.owner).data
        except NotFound:
            profile = {}
        owner = session.owner
        return skill_map.build(
            profile.get("skills") or [],
            [(r.id, {**VACANCY_DEFAULTS, **r.data}) for r in self.store.list("vacancy", owner)],
            [(r.id, r.data) for r in self.store.list("plan", owner)],
            [(r.id, r.created_at, r.data) for r in self.store.list("interview", owner)],
        )
