from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, Response, UploadFile
from pydantic import Field

from app.config import Settings
from app.contracts import ResumeFields, StrictModel
from app.domain.models import ResumeFields as DomainFields
from app.presentation.dependencies import Cases, Member
from app.presentation.errors import ApiError

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def domain_fields(data: dict) -> DomainFields:
    """Validate composed or profile-derived data against the external resume contract."""
    return DomainFields(**ResumeFields.model_validate(data).model_dump())


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
    language: Literal["ru", "en", "kk"] = "ru"
    title: str = Field(min_length=3, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=20, max_length=50000)
    published: bool = False
    revision: int = Field(default=0, ge=0)


def product_router(settings: Settings) -> APIRouter:
    routes = APIRouter()

    @routes.get("/capabilities")
    def capabilities(cases: Cases, current: Member):
        return {
            "admin": cases.auth.is_admin(current),
            "password_account": cases.auth.has_password(current),
            "ai": settings.provider in {"openai", "gemini", "local"},
            "voice": bool(
                settings.provider != "unconfigured"
                and settings.openai_api_key.get_secret_value()
                and settings.openai_realtime_model
                and settings.openai_transcription_model
            ),
            "development": settings.environment == "development",
        }

    @routes.post("/user/profile/import")
    def import_profile(file: UploadFile, cases: Cases, current: Member):
        data = file.file.read(settings.max_upload_bytes + 1)
        if len(data) > settings.max_upload_bytes:
            raise ApiError(413, "payload_too_large", "Upload is too large.")
        result = cases.profile_import.preview(current, file.filename or "", data)
        return {
            **result,
            "provider": settings.provider,
            "fields": ResumeFields.model_validate(result["fields"]).model_dump(),
        }

    @routes.get("/overview")
    def overview(
        cases: Cases,
        current: Member,
        offset: int = Query(default=0, ge=-720, le=840),
    ):
        return cases.overview.summary(current, offset)

    @routes.get("/preferences")
    def preferences(cases: Cases, current: Member):
        return cases.career.preferences(current)

    @routes.put("/preferences")
    def save_preferences(payload: Preferences, cases: Cases, current: Member):
        return cases.career.save_preferences(current, payload.widgets, payload.revision)

    @routes.post("/resume/create", status_code=201)
    def create_resume(payload: ResumeCreate, cases: Cases, current: Member):
        return cases.resumes.create(
            current,
            title=payload.title,
            position=payload.position,
            job=payload.job,
            sections=list(payload.sections),
            use_ai=payload.use_ai,
            facts=payload.facts,
            vacancy_id=str(payload.vacancy_id) if payload.vacancy_id else None,
            validate=domain_fields,
        )

    @routes.patch("/resume/{resume_id}/metadata")
    def metadata(resume_id: UUID, payload: Metadata, cases: Cases, current: Member):
        return cases.resumes.update_metadata(current, str(resume_id), **payload.model_dump())

    @routes.get("/resume/{resume_id}/docx")
    def docx(resume_id: UUID, cases: Cases, current: Member):
        return Response(
            cases.resumes.export_docx(current, str(resume_id)),
            media_type=DOCX,
            headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
        )

    @routes.get("/resume/{resume_id}/assessment")
    def assessment(resume_id: UUID, cases: Cases, current: Member):
        return cases.resumes.assessment(current, str(resume_id))

    @routes.get("/versions/{version_id}/docx")
    def version_docx(version_id: UUID, cases: Cases, current: Member):
        return Response(
            cases.resumes.export_version(current, str(version_id), "docx"),
            media_type=DOCX,
            headers={"Content-Disposition": 'attachment; filename="resume-version.docx"'},
        )

    @routes.get("/targets/{kind}")
    def targets(kind: Literal["company", "vacancy"], cases: Cases, current: Member):
        return cases.career.targets(current, kind)

    @routes.post("/targets/{kind}", status_code=201)
    def save_target(
        kind: Literal["company", "vacancy"], payload: Target, cases: Cases, current: Member
    ):
        return cases.career.save_target(current, kind, payload.model_dump())

    @routes.get("/knowledge")
    def knowledge(
        cases: Cases,
        q: str = Query(default="", max_length=200),
        language: Literal["ru", "en", "kk"] | None = None,
    ):
        return cases.knowledge.published(q, language)

    @routes.get("/admin/knowledge")
    def articles(cases: Cases, current: Member):
        return cases.knowledge.all(current)

    @routes.post("/admin/knowledge", status_code=201)
    def create_article(payload: Article, cases: Cases, current: Member):
        return cases.knowledge.save(current, payload.model_dump(exclude={"revision"}))

    @routes.put("/admin/knowledge/{article_id}")
    def save_article(article_id: UUID, payload: Article, cases: Cases, current: Member):
        return cases.knowledge.save(
            current, payload.model_dump(exclude={"revision"}), str(article_id), payload.revision
        )

    return routes
