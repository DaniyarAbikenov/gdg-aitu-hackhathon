from typing import Protocol

from app.domain.skills import skill_key, skill_name


class SkillRepository(Protocol):
    def search(self, key: str) -> list[dict]: ...
    def add(self, name: str, key: str, description: str) -> dict: ...


class SkillCatalog:
    def __init__(self, repository: SkillRepository):
        self.repository = repository

    def search(self, query: str):
        return self.repository.search(skill_key(query))

    def add(self, name: str, description: str):
        return self.repository.add(skill_name(name), skill_key(name), description.strip())
