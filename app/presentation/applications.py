from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import ConfigDict, Field, HttpUrl, field_validator

from app.contracts import StrictModel
from app.domain.errors import NotFound
from app.domain.models import Session
from app.presentation.api import COOKIE, workspace


def member(current: Session = Depends(workspace)):
    if not current.persistent:
        raise HTTPException(401, "Sign in to continue.")
    return current


class Application(StrictModel):
    revision: int = Field(default=0, ge=0)
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    company_name: str = Field(min_length=2, max_length=200)
    company_description: str = Field(default="", max_length=3000)
    company_id: UUID | None = None
    location: str = Field(default="", max_length=300)
    employment: str = Field(default="", max_length=200)
    salary: str = Field(default="", max_length=300)
    requirements: list[str] = Field(default_factory=list, max_length=30)
    responsibilities: list[str] = Field(default_factory=list, max_length=30)
    skills: list[str] = Field(default_factory=list, max_length=60)
    status: Literal[
        "saved", "preparing", "applied", "interview", "offer", "rejected", "archived"
    ] = "saved"
    source_url: HttpUrl | None = None
    resume_id: UUID | None = None
    notes: str = Field(default="", max_length=5000)
    next_action: str = Field(default="", max_length=500)
    follow_up: date | None = None

    @field_validator("name", "company_name", "description")
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError("Enter text")
        return value.strip()


class Assignment(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    source_url: HttpUrl | None = None
    kind: Literal["employer", "practice"] = "practice"


class Company(StrictModel):
    revision: int = Field(default=0, ge=0)
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=3000)
    website: HttpUrl | None = None
    location: str = Field(default="", max_length=300)
    skills: list[str] = Field(default_factory=list, max_length=60)
    hiring_process: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=5000)
    assignments: list[Assignment] = Field(default_factory=list, max_length=30)
    archived: bool = False


class VacancyImport(StrictModel):
    url: HttpUrl | None = None
    text: str = Field(default="", max_length=45000)
    language: Literal["ru", "en", "kk"] = "ru"


class PasswordChange(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class AccountDelete(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    password: str = Field(min_length=1, max_length=256)
    email: str = Field(min_length=3, max_length=254)


def applications_router():
    routes = APIRouter()

    @routes.get("/companies")
    def companies(request: Request, current: Session = Depends(member)):
        return request.app.state.companies.list(current)

    @routes.post("/companies", status_code=201)
    def create_company(payload: Company, request: Request, current: Session = Depends(member)):
        return request.app.state.companies.save(
            current, payload.model_dump(mode="json", exclude={"revision"})
        )

    @routes.put("/companies/{company_id}")
    def update_company(
        company_id: UUID, payload: Company, request: Request, current: Session = Depends(member)
    ):
        return request.app.state.companies.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            str(company_id),
            payload.revision,
        )

    @routes.post("/applications/import")
    def import_vacancy(
        payload: VacancyImport, request: Request, current: Session = Depends(member)
    ):
        if not payload.url and len(payload.text.strip()) < 60:
            raise HTTPException(422, "Paste a vacancy link or at least 60 characters of text.")
        request.app.state.sessions.consume_analysis(current)
        return request.app.state.vacancy_reader.parse(
            str(payload.url or ""), payload.text.strip(), payload.language
        )

    @routes.get("/applications")
    def applications(request: Request, current: Session = Depends(member)):
        return request.app.state.applications.list(current)

    @routes.post("/applications", status_code=201)
    def create(payload: Application, request: Request, current: Session = Depends(member)):
        return request.app.state.applications.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            revision=payload.revision,
        )

    @routes.put("/applications/{application_id}")
    def update(
        application_id: UUID,
        payload: Application,
        request: Request,
        current: Session = Depends(member),
    ):
        return request.app.state.applications.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            str(application_id),
            payload.revision,
        )

    @routes.get("/account/export")
    def export(request: Request, response: Response, current: Session = Depends(member)):
        response.headers["Content-Disposition"] = 'attachment; filename="careerbot-data.json"'
        response.headers["Cache-Control"] = "no-store"
        return request.app.state.accounts.export(current)

    @routes.post("/account/password", status_code=204)
    def password(
        payload: PasswordChange,
        request: Request,
        response: Response,
        current: Session = Depends(member),
    ):
        try:
            request.app.state.accounts.change_password(
                current, payload.password, payload.new_password, request.client.host
            )
        except NotFound as exc:
            raise HTTPException(403, "Incorrect current password.") from exc
        request.app.state.sessions.delete(request.cookies[COOKIE])
        response.delete_cookie(COOKIE, path="/")

    @routes.post("/account/delete", status_code=204)
    def delete(
        payload: AccountDelete,
        request: Request,
        response: Response,
        current: Session = Depends(member),
    ):
        try:
            request.app.state.accounts.delete(
                current, payload.password, payload.email, request.client.host
            )
        except NotFound as exc:
            raise HTTPException(403, "Incorrect current password.") from exc
        request.app.state.sessions.delete(request.cookies[COOKIE])
        response.delete_cookie(COOKIE, path="/")

    return routes
