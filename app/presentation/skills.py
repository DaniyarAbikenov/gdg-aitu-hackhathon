from fastapi import APIRouter, Query
from pydantic import Field, field_validator

from app.domain.skills import skill_name
from app.presentation.dependencies import Cases, Member
from app.presentation.schemas import StrictModel


class NewSkill(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=1000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        value = skill_name(value)
        if not value or len(value) > 80 or not any(c.isalnum() for c in value):
            raise ValueError("Enter a skill name containing letters or numbers")
        return value


def skill_router() -> APIRouter:
    routes = APIRouter(prefix="/skills", tags=["skills"])

    @routes.get("")
    def search(cases: Cases, current: Member, q: str = Query(default="", max_length=80)):
        return {"skills": cases.skills.search(q)}

    @routes.post("")
    def add(payload: NewSkill, cases: Cases, current: Member):
        return cases.skills.add(current, payload.name, payload.description)

    return routes
