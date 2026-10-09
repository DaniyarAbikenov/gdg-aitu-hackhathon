from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Request, Response, UploadFile
from fastapi.responses import FileResponse

from app.config import Settings
from app.domain.models import ResumeFields
from app.presentation.dependencies import (
    COOKIE,
    Cases,
    ClientId,
    RespondAsync,
    Workspace,
    clear_session_cookie,
    set_session_cookie,
)
from app.presentation.errors import ApiError
from app.presentation.jobs import ACCEPTED, accepted
from app.presentation.schemas import AnalyzeRequest, ResumeRecord, SaveRequest

__all__ = ["COOKIE", "router"]

ASSETS = Path(__file__).parents[1] / "assets"
SAMPLE_JOB = (
    "We are looking for a backend developer to build Python and FastAPI services. "
    "You will work with PostgreSQL, Docker, pytest and GitHub Actions. Experience "
    "with Redis and Kubernetes is welcome. Explain technical decisions and collaborate "
    "with designers to deliver accessible products."
)


def router(settings: Settings) -> APIRouter:
    routes = APIRouter()

    @routes.get("/", include_in_schema=False)
    def index():
        return {
            "service": "CareerBot API",
            "frontend": "Served by the frontend container",
            "schema": "/openapi.json",
        }

    @routes.get("/static/font", include_in_schema=False)
    def font():
        return FileResponse(ASSETS / "NotoSans-Regular.ttf", media_type="font/ttf")

    @routes.get("/health")
    def health(cases: Cases):
        cases.workspaces.health()
        return {
            "status": "ok",
            "version": "0.4.0",
            "provider": settings.provider,
            "development": settings.environment == "development",
        }

    @routes.post("/api/session", include_in_schema=False)
    @routes.post("/session")
    def session(request: Request, response: Response, cases: Cases, client: ClientId):
        token = cases.workspaces.open(request.cookies.get(COOKIE), client)
        if token:
            set_session_cookie(response, token, settings)
        return {"provider": settings.provider, "expires_in_hours": settings.session_hours}

    @routes.delete("/api/session", status_code=204, include_in_schema=False)
    @routes.delete("/session", status_code=204)
    def end_session(request: Request, response: Response, cases: Cases, current: Workspace):
        cases.workspaces.end_guest(current, request.cookies[COOKIE])
        clear_session_cookie(response)

    @routes.get("/api/example")
    def example():
        return {"resume": (ASSETS / "sample-resume.txt").read_text(), "job_description": SAMPLE_JOB}

    @routes.get("/resume", response_model=list[ResumeRecord])
    def list_resumes(cases: Cases, current: Workspace):
        return cases.resumes.library(current)

    @routes.post("/resume/upload", response_model=ResumeRecord, status_code=201)
    def upload(file: UploadFile, cases: Cases, current: Workspace):
        data = file.file.read(settings.max_upload_bytes + 1)
        if len(data) > settings.max_upload_bytes:
            raise ApiError(413, "payload_too_large", "Upload exceeds the configured size limit.")
        return cases.resumes.upload(current, file.filename or "resume.txt", data)

    @routes.get("/resume/{resume_id}", response_model=ResumeRecord)
    def get_resume(resume_id: UUID, cases: Cases, current: Workspace):
        return cases.resumes.get(current, str(resume_id))

    @routes.post("/resume/{resume_id}/save", response_model=ResumeRecord)
    def save(resume_id: UUID, payload: SaveRequest, cases: Cases, current: Workspace):
        return cases.resumes.save(
            current,
            str(resume_id),
            payload.revision,
            ResumeFields(**payload.fields.model_dump()),
        )

    @routes.post("/resume/{resume_id}/improve", response_model=ResumeRecord, responses=ACCEPTED)
    def improve(
        resume_id: UUID,
        payload: AnalyzeRequest,
        cases: Cases,
        current: Workspace,
        later: RespondAsync,
    ):
        arguments: dict[str, Any] = {
            "resume_id": str(resume_id),
            "revision": payload.revision,
            "jd_text": payload.jd_text,
        }
        if later:
            return accepted(cases.jobs.submit(current, "resume.analyze", **arguments))
        return cases.resumes.analyze(current, **arguments)

    @routes.get("/resume/{resume_id}/pdf")
    def pdf(
        resume_id: UUID,
        cases: Cases,
        current: Workspace,
        template: Literal["modern", "classic", "minimalist"] = "modern",
    ):
        return Response(
            cases.resumes.export(current, str(resume_id), template),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
        )

    @routes.delete("/resume/{resume_id}", status_code=204)
    def delete(resume_id: UUID, cases: Cases, current: Workspace):
        cases.resumes.delete(current, str(resume_id))

    return routes
