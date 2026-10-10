"""Typed FastAPI dependencies. Routers receive use cases here, never adapters."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request, Response

from app.application.accounts import Accounts
from app.application.adaptation import ResumeAdaptation
from app.application.ai_usage import AiUsageReport
from app.application.applications import Applications
from app.application.auth import Auth
from app.application.companies import Companies
from app.application.company_insights import CompanyInsights
from app.application.funnel import JobSearch
from app.application.interviews import InterviewService
from app.application.jobs import Jobs
from app.application.knowledge import Knowledge
from app.application.learning import LearningService
from app.application.linked_resumes import LinkedResumes
from app.application.overview import Overview
from app.application.profile import ProfileService
from app.application.profile_import import ProfileImport
from app.application.progress import ProgressService
from app.application.recovery import Recovery
from app.application.resumes import ResumeService
from app.application.skill_map import SkillMapService
from app.application.skills import SkillCatalog
from app.application.voice import VoiceInterviews
from app.application.workspaces import Workspaces
from app.config import Settings
from app.domain.models import Session

COOKIE = "career_session"


@dataclass
class UseCases:
    workspaces: Workspaces
    auth: Auth
    accounts: Accounts
    resumes: ResumeService
    profile_import: ProfileImport
    profile: ProfileService
    adaptation: ResumeAdaptation
    interviews: InterviewService
    learning: LearningService
    progress: ProgressService
    voice: VoiceInterviews
    applications: Applications
    companies: Companies
    overview: Overview
    skills: SkillCatalog
    knowledge: Knowledge
    jobs: Jobs
    recovery: Recovery
    ai_usage: AiUsageReport
    linked_resumes: LinkedResumes
    job_search: JobSearch
    skill_map: SkillMapService
    company_insights: CompanyInsights


def use_cases(request: Request) -> UseCases:
    return request.app.state.container.use_cases


def client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def workspace(request: Request, cases: Annotated[UseCases, Depends(use_cases)]) -> Session:
    return cases.workspaces.resolve(request.cookies.get(COOKIE))


def member(request: Request, cases: Annotated[UseCases, Depends(use_cases)]) -> Session:
    return cases.workspaces.member(request.cookies.get(COOKIE))


def prefers_async(request: Request) -> bool:
    """`Prefer: respond-async` (RFC 7240) asks for a 202 with a job instead of waiting."""
    return "respond-async" in request.headers.get("prefer", "")


Cases = Annotated[UseCases, Depends(use_cases)]
Workspace = Annotated[Session, Depends(workspace)]
Member = Annotated[Session, Depends(member)]
ClientId = Annotated[str, Depends(client_id)]
RespondAsync = Annotated[bool, Depends(prefers_async)]


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.secure_cookie,
        samesite="strict",
        max_age=settings.session_hours * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
