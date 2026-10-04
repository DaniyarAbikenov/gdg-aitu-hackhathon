from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse

from app.domain.errors import NotFound
from app.domain.models import ResumeFields, Session
from app.presentation.schemas import AnalyzeRequest, ResumeRecord, SaveRequest

COOKIE = "career_session"
ASSETS = Path(__file__).parents[1] / "assets"
SAMPLE_JOB = (
    "We are looking for a backend developer to build Python and FastAPI services. "
    "You will work with PostgreSQL, Docker, pytest and GitHub Actions. Experience "
    "with Redis and Kubernetes is welcome. Explain technical decisions and collaborate "
    "with designers to deliver accessible products."
)


def workspace(request: Request) -> Session:
    try:
        return request.app.state.sessions.resolve(request.cookies.get(COOKIE))
    except NotFound as exc:
        raise HTTPException(401, "Your session expired. Start a new workspace.") from exc


def router(settings):
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
    def health(request: Request):
        request.app.state.repository.health()
        request.app.state.sessions.health()
        return {"status": "ok", "version": "0.3.0", "provider": settings.provider}

    @routes.post("/api/session", include_in_schema=False)
    @routes.post("/session")
    def session(request: Request, response: Response):
        sessions = request.app.state.sessions
        try:
            sessions.resolve(request.cookies.get(COOKIE))
        except NotFound:
            token = sessions.create(request.client.host if request.client else "unknown")
            response.set_cookie(
                COOKIE,
                token,
                httponly=True,
                secure=settings.secure_cookie,
                samesite="strict",
                max_age=settings.session_hours * 3600,
                path="/",
            )
        return {"provider": settings.provider, "expires_in_hours": settings.session_hours}

    @routes.delete("/api/session", status_code=204, include_in_schema=False)
    @routes.delete("/session", status_code=204)
    def end_session(request: Request, response: Response, current: Session = Depends(workspace)):
        request.app.state.repository.delete_owner(current.owner)
        request.app.state.career.store.clear(current.owner)
        request.app.state.sessions.delete(request.cookies[COOKIE])
        response.delete_cookie(COOKIE, path="/")

    @routes.get("/api/example")
    def example():
        return {"resume": (ASSETS / "sample-resume.txt").read_text(), "job_description": SAMPLE_JOB}

    @routes.get("/resume", response_model=list[ResumeRecord])
    def list_resumes(request: Request, current: Session = Depends(workspace)):
        return request.app.state.repository.list(current.owner)

    @routes.post("/resume/upload", response_model=ResumeRecord, status_code=201)
    def upload(request: Request, file: UploadFile, current: Session = Depends(workspace)):
        data = file.file.read(settings.max_upload_bytes + 1)
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(413, "Upload exceeds the configured size limit.")
        return request.app.state.service.upload(current, file.filename or "resume.txt", data)

    @routes.get("/resume/{resume_id}", response_model=ResumeRecord)
    def get_resume(resume_id: UUID, request: Request, current: Session = Depends(workspace)):
        return request.app.state.repository.get(current.owner, str(resume_id))

    @routes.post("/resume/{resume_id}/save", response_model=ResumeRecord)
    def save(
        resume_id: UUID,
        payload: SaveRequest,
        request: Request,
        current: Session = Depends(workspace),
    ):
        return request.app.state.service.save(
            current,
            str(resume_id),
            payload.revision,
            ResumeFields(**payload.fields.model_dump()),
        )

    @routes.post("/resume/{resume_id}/improve", response_model=ResumeRecord)
    def improve(
        resume_id: UUID,
        payload: AnalyzeRequest,
        request: Request,
        current: Session = Depends(workspace),
    ):
        return request.app.state.service.analyze(
            current,
            str(resume_id),
            payload.revision,
            payload.jd_text,
        )

    @routes.get("/resume/{resume_id}/pdf")
    def pdf(
        resume_id: UUID,
        request: Request,
        template: Literal["modern", "classic", "minimalist"] = "modern",
        current: Session = Depends(workspace),
    ):
        return Response(
            request.app.state.service.export(current, str(resume_id), template),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
        )

    @routes.delete("/resume/{resume_id}", status_code=204)
    def delete(resume_id: UUID, request: Request, current: Session = Depends(workspace)):
        request.app.state.repository.delete(current.owner, str(resume_id))

    return routes
