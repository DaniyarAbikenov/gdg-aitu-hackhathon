"""Composition root: framework wiring and resource lifecycle only."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app.application.resumes import ResumeService
from app.config import Settings
from app.infrastructure.documents import Documents
from app.infrastructure.postgres import PostgresRepository
from app.infrastructure.redis_sessions import RedisSessions
from app.infrastructure.reviewer import Reviewer
from app.presentation.api import WEB, router
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
            Documents(),
            settings.max_upload_bytes,
        )

        async def cleanup():
            while True:
                try:
                    await asyncio.to_thread(repository.purge_expired, datetime.now(UTC))
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
        title="Career Studio",
        version="0.2.0",
        lifespan=lifespan,
        description="Upload, review, compare and export a factual resume. Start with /api/session.",
    )
    configure_http(app, settings)
    app.include_router(router(settings))
    app.mount("/static", StaticFiles(directory=WEB), name="static")
    return app


app = create_app()
