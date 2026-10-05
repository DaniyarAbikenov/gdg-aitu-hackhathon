from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field, field_validator

from app.domain.models import Session
from app.domain.skills import skill_name
from app.presentation.api import workspace
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


def skill_router():
    routes = APIRouter(prefix="/skills", tags=["skills"])

    def authenticated(current: Session = Depends(workspace)):
        if not current.persistent:
            raise HTTPException(401, "Sign in to use the skill catalog.")
        return current

    @routes.get("")
    def search(
        request: Request,
        q: str = Query(default="", max_length=80),
        current: Session = Depends(authenticated),
    ):
        return {"skills": request.app.state.skills.search(q)}

    @routes.post("")
    def add(payload: NewSkill, request: Request, current: Session = Depends(authenticated)):
        request.app.state.sessions.consume_skill(current)
        return request.app.state.skills.add(payload.name, payload.description)

    return routes
