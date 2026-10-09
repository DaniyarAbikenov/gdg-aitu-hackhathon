"""HTTP contracts for the connected CareerBot workflows."""

import re
from dataclasses import asdict
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import ConfigDict, Field, field_validator, model_validator

from app.config import Settings
from app.domain.periods import validate_history
from app.presentation.dependencies import (
    COOKIE,
    Cases,
    ClientId,
    Workspace,
    clear_session_cookie,
    set_session_cookie,
)
from app.presentation.responses import (
    InterviewView,
    PlanRecord,
    ProfileRecord,
    Progress,
    Record,
    VersionRecord,
)
from app.presentation.schemas import ResumeFields, ResumeRecord, StrictModel

EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
InterviewStyle = Literal["theoretical", "practical"]


def theory_only() -> list[InterviewStyle]:
    return ["theoretical"]


class Credentials(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        if not EMAIL.fullmatch(value):
            raise ValueError("Enter a valid email address")
        return value.strip().casefold()


class GoogleCredential(StrictModel):
    credential: str = Field(min_length=20, max_length=10000)


class ProfileExtra(StrictModel):
    languages: list[str] = Field(default_factory=list, max_length=30)
    normalized_skills: list[str] = Field(default_factory=list, max_length=60)


class Profile(ResumeFields):
    extra: ProfileExtra = Field(default_factory=ProfileExtra)
    desired_position: str = Field(default="", max_length=200)
    career_goal: str = Field(default="", max_length=1000)
    language: Literal["en", "ru", "kk"] = "en"
    audio_mode: bool = False


class ProfileSave(StrictModel):
    profile: Profile
    revision: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_dates(self):
        validate_history(self.profile.model_dump())
        return self


class Adapt(StrictModel):
    revision: int = Field(ge=1)
    jd_text: str = Field(min_length=30, max_length=15000)


class VersionSave(StrictModel):
    revision: int = Field(ge=1)
    jd_text: str = Field(default="", max_length=15000)
    fields: ResumeFields
    label: str = Field(min_length=1, max_length=160)


class Revision(StrictModel):
    revision: int = Field(ge=1)


class ApplyProposal(Revision):
    proposal_id: str = Field(min_length=1, max_length=30)


class InterviewStart(StrictModel):
    company_name: str = Field(default="", max_length=200)
    vacancy_title: str = Field(default="", max_length=200)
    company_id: str = Field(default="", max_length=36)
    vacancy_id: str = Field(default="", max_length=36)
    modes: list[InterviewStyle] = Field(default_factory=theory_only, min_length=1, max_length=2)
    mode: Literal["text", "voice"] = "text"
    company_description: str = Field(min_length=3, max_length=3000)
    job_description: str = Field(min_length=10, max_length=10000)
    tech_stack: str = Field(min_length=2, max_length=1000)
    style: Literal["theoretical", "practical", "mixed"] = "mixed"
    language: Literal["en", "ru", "kk"] = "en"


class Answer(Revision):
    answer: str = Field(min_length=1, max_length=10000)


class PlanCreate(StrictModel):
    vacancy_id: UUID | None = None
    position: str = Field(default="", max_length=200)
    stacks: list[str] = Field(default_factory=list, max_length=60)
    goal: str = Field(min_length=3, max_length=500)
    resume_id: UUID | None = None
    interview_id: UUID | None = None


class ModuleUpdate(Revision):
    completed: bool
    evidence: str = Field(default="", max_length=2000)


def career_router(settings: Settings) -> APIRouter:
    routes = APIRouter()

    def start_session(request: Request, response: Response, cases: Cases, token: str) -> None:
        cases.workspaces.sign_out(request.cookies.get(COOKIE))
        set_session_cookie(response, token, settings)

    @routes.post("/auth/register", status_code=201)
    def register(
        payload: Credentials,
        request: Request,
        response: Response,
        cases: Cases,
        current: Workspace,
        client: ClientId,
    ):
        token = cases.auth.register(current, payload.email, payload.password, client)
        start_session(request, response, cases, token)
        return {"authenticated": True}

    @routes.post("/auth/login")
    def login(
        payload: Credentials, request: Request, response: Response, cases: Cases, client: ClientId
    ):
        token = cases.auth.login(payload.email, payload.password, client)
        start_session(request, response, cases, token)
        return {"authenticated": True}

    @routes.post("/auth/logout", status_code=204)
    def logout(request: Request, response: Response, cases: Cases):
        cases.workspaces.sign_out(request.cookies.get(COOKIE))
        clear_session_cookie(response)

    @routes.post("/auth/google/nonce")
    def google_nonce(cases: Cases, current: Workspace, client: ClientId):
        return {
            "nonce": cases.auth.google_nonce(current, client),
            "client_id": settings.google_client_id,
        }

    @routes.post("/auth/google")
    def google_signin(
        payload: GoogleCredential,
        request: Request,
        response: Response,
        cases: Cases,
        current: Workspace,
        client: ClientId,
    ):
        token = cases.auth.google_sign_in(current, payload.credential, client)
        start_session(request, response, cases, token)
        return {"authenticated": True}

    @routes.get("/auth/options")
    def auth_options():
        return {"postgres": True, "google": bool(settings.google_client_id)}

    @routes.get("/user/me")
    def me(cases: Cases, current: Workspace):
        return {
            "uid": current.owner,
            "authenticated": current.persistent,
            "email": cases.auth.email(current),
        }

    @routes.get("/user/profile", response_model=ProfileRecord)
    def profile(cases: Cases, current: Workspace):
        record = cases.profile.get(current)
        return (
            asdict(record)
            if record
            else {"id": current.owner, "revision": 0, "data": Profile().model_dump()}
        )

    @routes.post("/user/profile/update", response_model=ProfileRecord)
    def save_profile(payload: ProfileSave, cases: Cases, current: Workspace):
        return cases.profile.save(current, payload.profile.model_dump(), payload.revision)

    @routes.post("/resume/{resume_id}/adapt")
    def adapt(resume_id: UUID, payload: Adapt, cases: Cases, current: Workspace):
        return cases.adaptation.adapt(current, str(resume_id), payload.revision, payload.jd_text)

    @routes.get("/resume/{resume_id}/versions", response_model=list[VersionRecord])
    def versions(resume_id: UUID, cases: Cases, current: Workspace):
        return cases.resumes.versions(current, str(resume_id))

    @routes.post("/resume/{resume_id}/versions", response_model=VersionRecord, status_code=201)
    def save_version(resume_id: UUID, payload: VersionSave, cases: Cases, current: Workspace):
        return cases.adaptation.save_version(
            current,
            str(resume_id),
            payload.revision,
            payload.fields.model_dump(),
            payload.label,
            payload.jd_text,
        )

    @routes.post("/versions/{version_id}/restore", response_model=ResumeRecord)
    def restore(version_id: UUID, payload: Revision, cases: Cases, current: Workspace):
        return cases.adaptation.restore_version(current, str(version_id), payload.revision)

    @routes.get("/versions/{version_id}/pdf")
    def version_pdf(version_id: UUID, cases: Cases, current: Workspace):
        return Response(
            cases.resumes.export_version(current, str(version_id), "pdf"),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume-version.pdf"'},
        )

    @routes.post("/interview/start", response_model=InterviewView, status_code=201)
    def start_interview(payload: InterviewStart, cases: Cases, current: Workspace):
        return cases.interviews.start(current, payload.model_dump())

    @routes.get("/interview", response_model=list[InterviewView])
    def interviews(cases: Cases, current: Workspace):
        return cases.interviews.history(current)

    @routes.get("/interview/{interview_id}", response_model=InterviewView)
    def interview(interview_id: UUID, cases: Cases, current: Workspace):
        return cases.interviews.get(current, str(interview_id))

    @routes.post("/interview/{interview_id}/answer", response_model=InterviewView)
    def answer(interview_id: UUID, payload: Answer, cases: Cases, current: Workspace):
        return cases.interviews.answer(current, str(interview_id), payload.revision, payload.answer)

    @routes.post("/resume/{resume_id}/apply")
    def apply_proposal(resume_id: UUID, payload: ApplyProposal, cases: Cases, current: Workspace):
        return cases.adaptation.apply_proposal(
            current, str(resume_id), payload.revision, payload.proposal_id
        )

    @routes.get("/plan", response_model=list[PlanRecord])
    def plans(cases: Cases, current: Workspace):
        return cases.learning.plans(current)

    @routes.post("/plan", response_model=PlanRecord, status_code=201)
    def create_plan(payload: PlanCreate, cases: Cases, current: Workspace):
        return cases.learning.create(
            current,
            payload.goal,
            str(payload.resume_id) if payload.resume_id else None,
            str(payload.interview_id) if payload.interview_id else None,
            payload.position,
            payload.stacks,
            str(payload.vacancy_id) if payload.vacancy_id else None,
        )

    @routes.post("/plan/{plan_id}/modules/{module_id}", response_model=PlanRecord)
    def module(
        plan_id: UUID, module_id: int, payload: ModuleUpdate, cases: Cases, current: Workspace
    ):
        return cases.learning.complete_module(
            current,
            str(plan_id),
            str(module_id),
            payload.revision,
            payload.completed,
            payload.evidence,
        )

    @routes.get("/plan/{plan_id}/export")
    def export_plan(plan_id: UUID, cases: Cases, current: Workspace):
        return Response(
            cases.learning.as_text(current, str(plan_id)),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="career-plan.txt"'},
        )

    @routes.get("/progress", response_model=Progress)
    def progress(cases: Cases, current: Workspace):
        return cases.progress.summary(current)

    @routes.post("/progress/rewards/{key}", response_model=Record, status_code=201)
    def claim_reward(key: str, cases: Cases, current: Workspace):
        return cases.progress.claim(current, key)

    @routes.delete("/career/{kind}/{record_id}", status_code=204)
    def delete_record(
        kind: Literal["plan", "interview", "version"],
        record_id: UUID,
        cases: Cases,
        current: Workspace,
    ):
        delete = {
            "plan": cases.learning.delete,
            "interview": cases.interviews.delete,
            "version": cases.adaptation.delete_version,
        }[kind]
        delete(current, str(record_id))

    return routes
