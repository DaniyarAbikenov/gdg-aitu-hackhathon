from datetime import date
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
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
from app.presentation.responses import (
    ApplicationItem,
    CoverLetterDraft,
    Funnel,
    Record,
    RejectionReason,
    RejectionResult,
    RejectionStage,
)


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
    # Omitted means "keep the saved letter", so older clients never erase it.
    cover_letter: str | None = Field(default=None, max_length=6000)

    def document(self) -> dict:
        data = self.model_dump(mode="json", exclude={"revision"})
        if data["cover_letter"] is None:
            del data["cover_letter"]
        return data

    @field_validator("name", "company_name", "description")
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError("Enter text")
        return value.strip()


class RejectionReview(StrictModel):
    revision: int = Field(ge=0)
    stage: RejectionStage | None = None
    reason: RejectionReason
    topics: list[str] = Field(default_factory=list, max_length=10)
    feedback: str = Field(default="", max_length=2000)

    @field_validator("topics")
    @classmethod
    def clean_topics(cls, value: list[str]) -> list[str]:
        result: list[str] = []
        for topic in value:
            topic = " ".join(topic.split())
            if len(topic) > 80:
                raise ValueError("Keep each topic under 80 characters")
            if topic and topic.casefold() not in {t.casefold() for t in result}:
                result.append(topic)
        return result


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


class LetterRequest(StrictModel):
    language: Literal["ru", "en", "kk"] = "ru"


class MailLanguage(StrictModel):
    language: Literal["ru", "en", "kk"] = "en"


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

    @routes.post(
        "/applications/{application_id}/cover-letter",
        response_model=CoverLetterDraft,
        responses=ACCEPTED,
    )
    def cover_letter(
        application_id: UUID,
        payload: LetterRequest,
        cases: Cases,
        current: Member,
        later: RespondAsync,
    ):
        arguments = {"vacancy_id": str(application_id), "language": payload.language}
        if later:
            return accepted(cases.jobs.submit(current, "letter.draft", **arguments))
        return cases.applications.cover_letter(current, **arguments)

    @routes.get("/applications/calendar.ics")
    def follow_up_calendar(cases: Cases, current: Member):
        return Response(
            cases.applications.follow_ups(current),
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="career-follow-ups.ics"'},
        )

    @routes.get("/applications/funnel", response_model=Funnel)
    def application_funnel(
        cases: Cases,
        current: Member,
        offset: int = Query(default=0, ge=-720, le=840),
    ):
        return cases.job_search.funnel(current, offset)

    @routes.put("/applications/{application_id}/rejection", response_model=RejectionResult)
    def review_rejection(
        application_id: UUID, payload: RejectionReview, cases: Cases, current: Member
    ):
        return cases.job_search.review_rejection(
            current,
            str(application_id),
            payload.revision,
            payload.model_dump(exclude={"revision"}),
        )

    @routes.get("/applications", response_model=list[ApplicationItem])
    def applications(cases: Cases, current: Member):
        return cases.applications.board(current)

    @routes.post("/applications", response_model=Record, status_code=201)
    def create(payload: Application, cases: Cases, current: Member):
        return cases.applications.save(
            current,
            payload.document(),
            revision=payload.revision,
        )

    @routes.put("/applications/{application_id}", response_model=Record)
    def update(application_id: UUID, payload: Application, cases: Cases, current: Member):
        return cases.applications.save(
            current,
            payload.document(),
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

    @routes.post("/account/email/verification", status_code=202)
    def send_verification(payload: MailLanguage, cases: Cases, current: Member):
        cases.recovery.send_verification(current, payload.language)
        return {"sent": True}

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
