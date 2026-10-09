"""Composition root: framework wiring and resource lifecycle only."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.application.accounts import Accounts
from app.application.adaptation import ResumeAdaptation
from app.application.applications import Applications
from app.application.auth import Administrators, Auth
from app.application.companies import Companies
from app.application.interviews import InterviewService
from app.application.jobs import Jobs
from app.application.knowledge import Knowledge
from app.application.learning import LearningService
from app.application.overview import Overview
from app.application.ports import ResumeReviewer
from app.application.profile import ProfileService
from app.application.profile_import import ProfileImport
from app.application.progress import ProgressService
from app.application.recovery import Recovery
from app.application.resumes import ResumeService
from app.application.skills import SkillCatalog
from app.application.voice import VoiceInterviews
from app.application.workspaces import Workspaces
from app.config import Settings
from app.infrastructure.activity import ActivityRepository
from app.infrastructure.career_store import PostgresCareerRepository
from app.infrastructure.coach import Coach
from app.infrastructure.documents import Documents
from app.infrastructure.google_login import GoogleLogin
from app.infrastructure.jobs import QueuedMailer, RedisJobQueue
from app.infrastructure.knowledge import KnowledgeRepository
from app.infrastructure.mail import SmtpMailer
from app.infrastructure.observability import (
    RequestContext,
    configure_logging,
    init_sentry,
    init_tracing,
    trace_engine,
)
from app.infrastructure.passwords import ScryptPasswords
from app.infrastructure.postgres import PostgresRepository
from app.infrastructure.redis_sessions import RedisSessions
from app.infrastructure.reviewer import Reviewer
from app.infrastructure.skills import PostgresSkillRepository
from app.infrastructure.vacancy_reader import VacancyReader
from app.infrastructure.voice import RealtimeVoice
from app.presentation.api import router
from app.presentation.applications import applications_router
from app.presentation.career import career_router
from app.presentation.dependencies import UseCases
from app.presentation.http import configure_http
from app.presentation.jobs import jobs_router
from app.presentation.product import product_router
from app.presentation.skills import skill_router
from app.presentation.voice import voice_router


@dataclass
class Container:
    """Adapters owned by the process, plus the use cases built on top of them."""

    repository: PostgresRepository
    career_store: PostgresCareerRepository
    sessions: RedisSessions
    jobs: RedisJobQueue
    use_cases: UseCases
    # Used by the worker to deliver queued email; None when SMTP is not configured.
    smtp: SmtpMailer | None = None

    def close(self) -> None:
        self.jobs.close()
        self.sessions.close()
        self.repository.close()


def build_container(settings: Settings, reviewer: ResumeReviewer | None = None) -> Container:
    repository = PostgresRepository(settings.database_url)
    sessions = RedisSessions(settings)
    jobs = RedisJobQueue(settings.redis_url, settings.redis_namespace)
    store = PostgresCareerRepository(repository)
    activity = ActivityRepository(repository.sessions)
    documents = Documents(settings)
    passwords = ScryptPasswords()
    smtp_url = settings.smtp_url.get_secret_value()
    smtp = SmtpMailer(smtp_url, settings.mail_from) if smtp_url else None

    resumes = ResumeService(
        repository,
        store,
        sessions,
        reviewer or Reviewer(settings),
        documents,
        settings.max_upload_bytes,
    )
    coach = Coach(settings)
    profile = ProfileService(store)
    interviews = InterviewService(store, sessions, coach, profile)
    progress = ProgressService(store, repository)
    auth = Auth(
        store,
        sessions,
        passwords,
        GoogleLogin(settings.google_client_id),
        Administrators.parse(settings.admin_emails),
        google_enabled=bool(settings.google_client_id),
    )
    use_cases = UseCases(
        workspaces=Workspaces(sessions, repository, store),
        auth=auth,
        accounts=Accounts(store, repository, sessions, passwords, activity),
        resumes=resumes,
        profile_import=ProfileImport(documents, sessions, settings.max_upload_bytes),
        profile=profile,
        adaptation=ResumeAdaptation(store, repository, sessions, coach, profile),
        interviews=interviews,
        learning=LearningService(store, repository, sessions, coach, profile),
        progress=progress,
        voice=VoiceInterviews(interviews, sessions, RealtimeVoice(settings), coach),
        applications=Applications(
            store, repository, sessions, VacancyReader(settings), coach, profile
        ),
        companies=Companies(store),
        overview=Overview(store, repository, progress, profile, activity),
        skills=SkillCatalog(PostgresSkillRepository(repository.engine), sessions),
        knowledge=Knowledge(KnowledgeRepository(repository.sessions), auth),
        jobs=Jobs(jobs),
        recovery=Recovery(
            store,
            sessions,
            passwords,
            QueuedMailer(jobs) if smtp else None,
            settings.public_url,
        ),
    )
    return Container(repository, store, sessions, jobs, use_cases, smtp)


VERSION = "0.5.0"


def configure_observability(settings: Settings, service: str, app: FastAPI | None = None) -> None:
    configure_logging(settings.log_level, settings.log_format)
    init_sentry(settings.sentry_dsn.get_secret_value(), settings.environment, VERSION)
    if settings.otel_enabled:
        init_tracing(service, app)


def create_app(settings=None, reviewer=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        container = build_container(settings, reviewer)
        app.state.container = container
        if settings.otel_enabled:
            trace_engine(container.repository.engine)

        async def cleanup():
            while True:
                try:
                    now = datetime.now(UTC)
                    await asyncio.to_thread(container.repository.purge_expired, now)
                    await asyncio.to_thread(container.career_store.purge_expired, now)
                except SQLAlchemyError:
                    logging.getLogger("career").warning("Expiration cleanup will retry")
                await asyncio.sleep(300)

        task = None
        try:
            await asyncio.to_thread(container.use_cases.workspaces.health)
            task = asyncio.create_task(cleanup())
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            container.close()

    app = FastAPI(
        title="CareerBot",
        servers=[{"url": "/api", "description": "Docker gateway"}],
        version=VERSION,
        lifespan=lifespan,
        description="Upload, review, compare and export a factual resume. Start with /api/session.",
    )
    configure_observability(settings, "career-api", app)
    configure_http(app, settings)
    app.include_router(router(settings))
    app.include_router(career_router(settings))
    app.include_router(skill_router())
    app.include_router(product_router(settings))
    app.include_router(voice_router())
    app.include_router(applications_router())
    app.include_router(jobs_router())
    # Outermost, so the id and the access line cover every other middleware.
    app.add_middleware(RequestContext)
    return app


app = create_app()
