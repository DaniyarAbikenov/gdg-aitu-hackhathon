from datetime import date
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import ConfigDict, Field, HttpUrl, field_validator

from app.contracts import StrictModel
from app.presentation.dependencies import (
    COOKIE,
    Cases,
    ClientId,
    Member,
    RespondAsync,
    clear_session_cookie,
)
from app.presentation.jobs import ACCEPTED, accepted
from app.presentation.responses import ApplicationItem, Record


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


def applications_router() -> APIRouter:
    routes = APIRouter()

    @routes.get("/companies", response_model=list[Record])
    def companies(cases: Cases, current: Member):
        return cases.companies.list(current)

    @routes.post("/companies", response_model=Record, status_code=201)
    def create_company(payload: Company, cases: Cases, current: Member):
        return cases.companies.save(current, payload.model_dump(mode="json", exclude={"revision"}))

    @routes.put("/companies/{company_id}", response_model=Record)
    def update_company(company_id: UUID, payload: Company, cases: Cases, current: Member):
        return cases.companies.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            str(company_id),
            payload.revision,
        )

    @routes.post("/applications/import", responses=ACCEPTED)
    def import_vacancy(payload: VacancyImport, cases: Cases, current: Member, later: RespondAsync):
        arguments: dict[str, Any] = {
            "url": str(payload.url or ""),
            "text": payload.text,
            "language": payload.language,
        }
        if later:
            return accepted(cases.jobs.submit(current, "vacancy.import", **arguments))
        return cases.applications.import_draft(current, **arguments)

    @routes.get("/applications", response_model=list[ApplicationItem])
    def applications(cases: Cases, current: Member):
        return cases.applications.board(current)

    @routes.post("/applications", response_model=Record, status_code=201)
    def create(payload: Application, cases: Cases, current: Member):
        return cases.applications.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            revision=payload.revision,
        )

    @routes.put("/applications/{application_id}", response_model=Record)
    def update(application_id: UUID, payload: Application, cases: Cases, current: Member):
        return cases.applications.save(
            current,
            payload.model_dump(mode="json", exclude={"revision"}),
            str(application_id),
            payload.revision,
        )

    @routes.get("/account/export")
    def export(response: Response, cases: Cases, current: Member):
        response.headers["Content-Disposition"] = 'attachment; filename="careerbot-data.json"'
        response.headers["Cache-Control"] = "no-store"
        return cases.accounts.export(current)

    @routes.post("/account/password", status_code=204)
    def password(
        payload: PasswordChange,
        request: Request,
        response: Response,
        cases: Cases,
        current: Member,
        client: ClientId,
    ):
        cases.accounts.change_password(current, payload.password, payload.new_password, client)
        cases.workspaces.sign_out(request.cookies[COOKIE])
        clear_session_cookie(response)

    @routes.post("/account/delete", status_code=204)
    def delete(
        payload: AccountDelete,
        request: Request,
        response: Response,
        cases: Cases,
        current: Member,
        client: ClientId,
    ):
        cases.accounts.delete(current, payload.password, payload.email, client)
        cases.workspaces.sign_out(request.cookies[COOKIE])
        clear_session_cookie(response)

    return routes
