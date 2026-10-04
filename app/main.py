"""Composition root: framework wiring and resource lifecycle only."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.application.career import CareerService
from app.application.resumes import ResumeService
from app.config import Settings
from app.infrastructure.career_store import PostgresCareerRepository
from app.infrastructure.coach import Coach
from app.infrastructure.documents import Documents
from app.infrastructure.google_login import GoogleLogin
from app.infrastructure.passwords import ScryptPasswords
from app.infrastructure.postgres import PostgresRepository
from app.infrastructure.redis_sessions import RedisSessions
from app.infrastructure.reviewer import Reviewer
from app.presentation.api import router
from app.presentation.career import career_router
from app.presentation.http import configure_http


def create_app(settings=None, reviewer=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        repository = PostgresRepository(settings.database_url)
        sessions = RedisSessions(settings)
        app.state.repository, app.state.sessions = repository, sessions
        app.state.service = ResumeService(
            repository,
            sessions,
            reviewer or Reviewer(settings),
            Documents(settings),
            settings.max_upload_bytes,
        )

        app.state.google_login = GoogleLogin(settings.google_client_id)
        career_store = PostgresCareerRepository(repository)
        app.state.career = CareerService(
            career_store, repository, sessions, Coach(settings), ScryptPasswords()
        )

        async def cleanup():
            while True:
                try:
                    await asyncio.to_thread(repository.purge_expired, datetime.now(UTC))
                    await asyncio.to_thread(career_store.purge_expired, datetime.now(UTC))
                except SQLAlchemyError:
                    logging.getLogger("career").warning("Expiration cleanup will retry")
                await asyncio.sleep(300)

        task = None
        try:
            await asyncio.to_thread(repository.health)
            await asyncio.to_thread(sessions.health)
            task = asyncio.create_task(cleanup())
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            sessions.close()
            repository.close()

    app = FastAPI(
        title="CareerBot",
        servers=[{"url": "/api", "description": "Docker gateway"}],
        version="0.3.0",
        lifespan=lifespan,
        description="Upload, review, compare and export a factual resume. Start with /api/session.",
    )
    configure_http(app, settings)
    app.include_router(router(settings))
    app.include_router(career_router(settings))
    return app


app = create_app()
