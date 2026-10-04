"""HTTP contracts for the connected CareerBot workflows."""

from dataclasses import asdict
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import ConfigDict, Field, field_validator

from app.domain.errors import Conflict, NotFound
from app.domain.models import ResumeFields as DomainFields
from app.domain.models import Session
from app.presentation.api import COOKIE, workspace
from app.presentation.schemas import ResumeFields, StrictModel


class Credentials(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        import re

        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
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


class InterviewStart(StrictModel):
    company_description: str = Field(min_length=3, max_length=3000)
    job_description: str = Field(min_length=10, max_length=10000)
    tech_stack: str = Field(min_length=2, max_length=1000)
    style: Literal["theoretical", "practical", "mixed"] = "mixed"
    language: Literal["en", "ru", "kk"] = "en"


class Answer(Revision):
    answer: str = Field(min_length=1, max_length=10000)


class PlanCreate(StrictModel):
    goal: str = Field(min_length=3, max_length=500)
    resume_id: UUID | None = None
    interview_id: UUID | None = None


class ModuleUpdate(Revision):
    completed: bool
    evidence: str = Field(default="", max_length=2000)


def career_router(settings):
    routes = APIRouter()

    def client_id(request):
        return request.client.host if request.client else "unknown"

    def set_session(request, response, token):
        old = request.cookies.get(COOKIE)
        if old:
            request.app.state.sessions.delete(old)
        response.set_cookie(
            COOKIE,
            token,
            httponly=True,
            secure=settings.secure_cookie,
            samesite="strict",
            max_age=settings.session_hours * 3600,
            path="/",
        )

    @routes.post("/auth/register", status_code=201)
    def register(
        payload: Credentials,
        request: Request,
        response: Response,
        current: Session = Depends(workspace),
    ):
        try:
            token = request.app.state.career.register(
                current, payload.email, payload.password, client_id(request)
            )
        except Conflict as exc:
            raise HTTPException(409, "Account already exists. Sign in instead.") from exc
        set_session(request, response, token)
        return {"authenticated": True}

    @routes.post("/auth/login")
    def login(payload: Credentials, request: Request, response: Response):
        try:
            token = request.app.state.career.login(
                payload.email, payload.password, client_id(request)
            )
        except NotFound as exc:
            raise HTTPException(401, "Incorrect email or password.") from exc
        set_session(request, response, token)
        return {"authenticated": True}

    @routes.post("/auth/logout", status_code=204)
    def logout(request: Request, response: Response):
        token = request.cookies.get(COOKIE)
        if token:
            request.app.state.sessions.delete(token)
        response.delete_cookie(COOKIE, path="/")

    @routes.post("/auth/google/nonce")
    def google_nonce(request: Request, current: Session = Depends(workspace)):
        if not settings.google_client_id:
            raise HTTPException(503, "Google sign-in is not configured on this server.")
        if current.persistent:
            raise HTTPException(409, "Sign out before switching accounts.")
        request.app.state.sessions.consume_auth(client_id(request))
        return {
            "nonce": request.app.state.sessions.google_nonce(current.owner),
            "client_id": settings.google_client_id,
        }

    @routes.post("/auth/google")
    def google_signin(
        payload: GoogleCredential,
        request: Request,
        response: Response,
        current: Session = Depends(workspace),
    ):
        if not settings.google_client_id:
            raise HTTPException(503, "Google sign-in is not configured on this server.")
        if current.persistent:
            raise HTTPException(409, "Sign out before switching accounts.")
        try:
            nonce = request.app.state.sessions.consume_google_nonce(current.owner)
            identity = request.app.state.google_login.verify(payload.credential, nonce)
            owner = request.app.state.career.store.google_account(
                identity["subject"], identity["email"], current.owner
            )
        except NotFound as exc:
            raise HTTPException(
                401, "Google sign-in expired or could not be verified. Try again."
            ) from exc
        except Conflict as exc:
            raise HTTPException(
                409, "An account with this email exists. Use its original sign-in method."
            ) from exc
        token = request.app.state.sessions.create(client_id(request), owner=owner)
        set_session(request, response, token)
        return {"authenticated": True}

    @routes.get("/auth/options")
    def auth_options():
        return {"postgres": True, "google": bool(settings.google_client_id)}

    @routes.get("/user/me")
    def me(request: Request, current: Session = Depends(workspace)):
        return {
            "uid": current.owner,
            "authenticated": current.persistent,
            "email": request.app.state.career.store.email_for_owner(current.owner)
            if current.persistent
            else "",
        }

    @routes.get("/user/profile")
    def profile(request: Request, current: Session = Depends(workspace)):
        record = request.app.state.career.profile(current)
        return (
            asdict(record)
            if record
            else {"id": current.owner, "revision": 0, "data": Profile().model_dump()}
        )

    @routes.post("/user/profile/update")
    def save_profile(payload: ProfileSave, request: Request, current: Session = Depends(workspace)):
        return request.app.state.career.save_profile(
            current, payload.profile.model_dump(), payload.revision
        )

    @routes.post("/resume/{resume_id}/adapt")
    def adapt(
        resume_id: UUID, payload: Adapt, request: Request, current: Session = Depends(workspace)
    ):
        return request.app.state.career.adapt(
            current, str(resume_id), payload.revision, payload.jd_text
        )

    @routes.get("/resume/{resume_id}/versions")
    def versions(resume_id: UUID, request: Request, current: Session = Depends(workspace)):
        request.app.state.repository.get(current.owner, str(resume_id))
        return [
            v
            for v in request.app.state.career.store.list("version", current.owner)
            if v.data["resume_id"] == str(resume_id)
        ]

    @routes.post("/resume/{resume_id}/versions", status_code=201)
    def save_version(
        resume_id: UUID,
        payload: VersionSave,
        request: Request,
        current: Session = Depends(workspace),
    ):
        return request.app.state.career.save_version(
            current,
            str(resume_id),
            payload.revision,
            payload.fields.model_dump(),
            payload.label,
            payload.jd_text,
        )

    @routes.post("/versions/{version_id}/restore")
    def restore(
        version_id: UUID, payload: Revision, request: Request, current: Session = Depends(workspace)
    ):
        return request.app.state.career.restore_version(current, str(version_id), payload.revision)

    @routes.get("/versions/{version_id}/pdf")
    def version_pdf(version_id: UUID, request: Request, current: Session = Depends(workspace)):
        version = request.app.state.career.store.get("version", current.owner, str(version_id))
        pdf = request.app.state.service.documents.pdf(DomainFields(**version.data["fields"]))
        return Response(
            pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume-version.pdf"'},
        )

    @routes.post("/interview/start", status_code=201)
    def start_interview(
        payload: InterviewStart, request: Request, current: Session = Depends(workspace)
    ):
        service = request.app.state.career
        return service.public_interview(service.start_interview(current, payload.model_dump()))

    @routes.get("/interview")
    def interviews(request: Request, current: Session = Depends(workspace)):
        service = request.app.state.career
        return [service.public_interview(r) for r in service.store.list("interview", current.owner)]

    @routes.get("/interview/{interview_id}")
    def interview(interview_id: UUID, request: Request, current: Session = Depends(workspace)):
        service = request.app.state.career
        return service.public_interview(
            service.store.get("interview", current.owner, str(interview_id))
        )

    @routes.post("/interview/{interview_id}/answer")
    def answer(
        interview_id: UUID, payload: Answer, request: Request, current: Session = Depends(workspace)
    ):
        service = request.app.state.career
        return service.public_interview(
            service.answer(current, str(interview_id), payload.revision, payload.answer)
        )

    @routes.get("/plan")
    def plans(request: Request, current: Session = Depends(workspace)):
        return request.app.state.career.store.list("plan", current.owner)

    @routes.post("/plan", status_code=201)
    def create_plan(payload: PlanCreate, request: Request, current: Session = Depends(workspace)):
        return request.app.state.career.create_plan(
            current,
            payload.goal,
            str(payload.resume_id) if payload.resume_id else None,
            str(payload.interview_id) if payload.interview_id else None,
        )

    @routes.post("/plan/{plan_id}/modules/{module_id}")
    def module(
        plan_id: UUID,
        module_id: int,
        payload: ModuleUpdate,
        request: Request,
        current: Session = Depends(workspace),
    ):
        return request.app.state.career.complete_module(
            current,
            str(plan_id),
            str(module_id),
            payload.revision,
            payload.completed,
            payload.evidence,
        )

    @routes.get("/plan/{plan_id}/export")
    def export_plan(plan_id: UUID, request: Request, current: Session = Depends(workspace)):
        plan = request.app.state.career.store.get("plan", current.owner, str(plan_id))
        lines = [plan.data["goal"], plan.data["explanation"], f"Provider: {plan.data['provider']}"]
        for week in plan.data["modules"]:
            lines += [
                f"\nWeek {week['id']}: {week['title']} ({week['hours']} hours)",
                *week["goals"],
                week["exercise"],
                "Resource topic: " + week["resource_topic"],
                "Completed: " + str(week["completed"]),
                "Evidence: " + week["evidence"],
            ]
        return Response(
            "\n".join(lines),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="career-plan.txt"'},
        )

    @routes.get("/progress")
    def progress(request: Request, current: Session = Depends(workspace)):
        return request.app.state.career.progress(current)

    @routes.post("/progress/rewards/{key}", status_code=201)
    def claim_reward(key: str, request: Request, current: Session = Depends(workspace)):
        return request.app.state.career.claim_reward(current, key)

    @routes.delete("/career/{kind}/{record_id}", status_code=204)
    def delete_record(
        kind: Literal["plan", "interview", "version"],
        record_id: UUID,
        request: Request,
        current: Session = Depends(workspace),
    ):
        request.app.state.career.store.delete(kind, current.owner, str(record_id))

    return routes
