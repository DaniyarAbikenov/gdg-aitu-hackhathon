from typing import Protocol

from app.application.ports import SessionStore
from app.domain.models import Session
from app.domain.skills import skill_key, skill_name


class SkillRepository(Protocol):
    def search(self, key: str) -> list[dict]: ...
    def add(self, name: str, key: str, description: str) -> dict: ...


class SkillCatalog:
    def __init__(self, repository: SkillRepository, sessions: SessionStore):
        self.repository, self.sessions = repository, sessions

    def search(self, query: str) -> list[dict]:
        return self.repository.search(skill_key(query))

    def add(self, session: Session, name: str, description: str) -> dict:
        self.sessions.consume_skill(session)
        return self.repository.add(skill_name(name), skill_key(name), description.strip())
