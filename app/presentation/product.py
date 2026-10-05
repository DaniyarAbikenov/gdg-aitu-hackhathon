from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import Field

from app.contracts import ResumeFields, StrictModel
from app.domain.errors import NotFound
from app.domain.models import ResumeFields as DomainFields
from app.domain.models import Session
from app.presentation.api import workspace


class ResumeCreate(StrictModel):
    vacancy_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    position: str = Field(default="", max_length=200)
    job: str = Field(default="", max_length=15000)
    sections: list[
        Literal[
            "summary", "experience", "education", "projects", "skills", "certificates", "languages"
        ]
    ] = Field(default_factory=list, max_length=7)
    use_ai: bool = False
    facts: str = Field(default="", max_length=10000)


class Metadata(StrictModel):
    revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    lifecycle: Literal["draft", "active", "archived"] = "draft"


class Preferences(StrictModel):
    widgets: list[Literal["resumes", "skills", "companies", "learning", "activity", "journey"]] = (
        Field(max_length=6)
    )
    revision: int = Field(default=0, ge=0)


class Target(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    company_id: str = Field(default="", max_length=36)
    skills: list[str] = Field(default_factory=list, max_length=60)


class Article(StrictModel):
    title: str = Field(min_length=3, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=20, max_length=50000)
    published: bool = False
    revision: int = Field(default=0, ge=0)


def product_router(settings):
    routes = APIRouter()

    def member(current: Session = Depends(workspace)):
        if not current.persistent:
            raise HTTPException(401, "Sign in to continue.")
        return current

    def is_admin(request, current):
        email = request.app.state.career.store.email_for_owner(current.owner)
        return email.casefold() in {
            e.strip().casefold() for e in settings.admin_emails.split(",") if e.strip()
        }

    def admin(request: Request, current: Session = Depends(member)):
        if not is_admin(request, current):
            raise HTTPException(403, "Administrator access required.")
        return current

    @routes.get("/capabilities")
    def capabilities(request: Request, current: Session = Depends(member)):
        return {
            "admin": is_admin(request, current),
            "password_account": bool(
                request.app.state.career.store.account_for_owner(current.owner)["password_hash"]
            ),
            "ai": settings.provider in {"openai", "gemini", "local"},
            "voice": bool(
                settings.provider != "unconfigured"
                and settings.openai_api_key.get_secret_value()
                and settings.openai_realtime_model
                and settings.openai_transcription_model
            ),
            "development": settings.environment == "development",
        }

    @routes.get("/overview")
    def overview(
        request: Request,
        offset: int = Query(default=0, ge=-720, le=840),
        current: Session = Depends(member),
    ):
        return request.app.state.overview.summary(current, offset)

    @routes.get("/preferences")
    def preferences(request: Request, current: Session = Depends(member)):
        try:
            return request.app.state.career.store.get("preferences", current.owner, current.owner)
        except NotFound:
            return {
                "revision": 0,
                "data": {
                    "widgets": ["resumes", "skills", "companies", "learning", "activity", "journey"]
                },
            }

    @routes.put("/preferences")
    def save_preferences(
        payload: Preferences, request: Request, current: Session = Depends(member)
    ):
        store = request.app.state.career.store
        data = {"widgets": list(dict.fromkeys(payload.widgets))}
        return (
            store.update("preferences", current.owner, current.owner, payload.revision, data)
            if payload.revision
            else store.create("preferences", current, data, current.owner)
        )

    @routes.post("/resume/create", status_code=201)
    def create_resume(payload: ResumeCreate, request: Request, current: Session = Depends(member)):
        if payload.vacancy_id:
            request.app.state.career.store.get("vacancy", current.owner, str(payload.vacancy_id))
        profile = request.app.state.career.profile_data(current)
        fields = {
            k: v
            for k, v in profile.items()
            if k in {"full_name", "email", "phone", "location", *payload.sections}
        }
        fields["position"] = payload.position
        if payload.use_ai:
            request.app.state.sessions.consume_analysis(current)
            result = request.app.state.service.documents.compose(
                fields, payload.position, payload.job, payload.facts
            )
            if result["questions"]:
                return {"questions": result["questions"]}
            fields = result["fields"]
        if payload.vacancy_id:
            request.app.state.career.store.get("vacancy", current.owner, str(payload.vacancy_id))
        record = request.app.state.repository.create(
            current,
            "Created resume",
            DomainFields(**ResumeFields.model_validate(fields).model_dump()),
            title=payload.title,
            description=payload.job[:2000],
            vacancy_id=str(payload.vacancy_id) if payload.vacancy_id else None,
        )
        return {"resume": record, "questions": []}

    @routes.patch("/resume/{resume_id}/metadata")
    def metadata(
        resume_id: UUID, payload: Metadata, request: Request, current: Session = Depends(member)
    ):
        return request.app.state.repository.metadata(
            current.owner, str(resume_id), **payload.model_dump()
        )

    @routes.get("/resume/{resume_id}/docx")
    def docx(resume_id: UUID, request: Request, current: Session = Depends(member)):
        record = request.app.state.repository.get(current.owner, str(resume_id))
        return Response(
            request.app.state.service.documents.docx(record.fields),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
        )

    @routes.get("/resume/{resume_id}/assessment")
    def assessment(resume_id: UUID, request: Request, current: Session = Depends(member)):
        resume = request.app.state.repository.get(current.owner, str(resume_id))
        for item in request.app.state.career.store.list("assessment", current.owner):
            if (
                item.data["resume_id"] == str(resume_id)
                and item.data["resume_revision"] == resume.revision
            ):
                return item.data
        return None

    @routes.get("/versions/{version_id}/docx")
    def version_docx(version_id: UUID, request: Request, current: Session = Depends(member)):
        version = request.app.state.career.store.get("version", current.owner, str(version_id))
        fields = DomainFields(**version.data["fields"])
        return Response(
            request.app.state.service.documents.docx(fields),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": 'attachment; filename="resume-version.docx"'},
        )

    @routes.get("/targets/{kind}")
    def targets(
        kind: Literal["company", "vacancy"], request: Request, current: Session = Depends(member)
    ):
        return request.app.state.career.store.list(kind, current.owner)

    @routes.post("/targets/{kind}", status_code=201)
    def save_target(
        kind: Literal["company", "vacancy"],
        payload: Target,
        request: Request,
        current: Session = Depends(member),
    ):
        if payload.company_id:
            request.app.state.career.store.get("company", current.owner, payload.company_id)
        return request.app.state.career.store.create(kind, current, payload.model_dump())

    @routes.get("/knowledge")
    def knowledge(request: Request, q: str = Query(default="", max_length=200)):
        return request.app.state.knowledge.list(q)

    @routes.get("/admin/knowledge")
    def articles(request: Request, current: Session = Depends(admin)):
        return request.app.state.knowledge.list("", admin=True)

    @routes.post("/admin/knowledge", status_code=201)
    def create_article(payload: Article, request: Request, current: Session = Depends(admin)):
        return request.app.state.knowledge.save(payload.model_dump(exclude={"revision"}))

    @routes.put("/admin/knowledge/{article_id}")
    def save_article(
        article_id: UUID, payload: Article, request: Request, current: Session = Depends(admin)
    ):
        return request.app.state.knowledge.save(
            payload.model_dump(exclude={"revision"}), str(article_id), payload.revision
        )

    return routes
