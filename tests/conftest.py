import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings():
    url = os.environ.get("CAREER_DATABASE_URL", "")
    if not url or make_url(url).database != "career_test":
        pytest.fail("Integration tests require a dedicated PostgreSQL database named career_test.")
    return Settings(
        _env_file=None,
        database_url=url,
        provider="local",
        redis_url=os.environ["CAREER_REDIS_URL"],
        redis_namespace=f"career:test:{uuid4()}",
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app, settings):
    engine = create_engine(settings.database_url)
    with engine.begin() as db:
        db.execute(
            text(
                "TRUNCATE TABLE resumes, accounts, career_profiles, career_interviews, career_plans, resume_versions, career_rewards, career_preferences, career_companies, career_vacancies, career_activity, career_assessments"
            )
        )
    engine.dispose()
    # Start expiry cleanup only after the exclusive fixture reset has finished.
    with TestClient(app) as client:
        client.post("/api/session")
        yield client
        keys = list(app.state.sessions.client.scan_iter(app.state.sessions.namespace + ":*"))
        if keys:
            app.state.sessions.client.delete(*keys)


@pytest.fixture
def resume(client):
    example = client.get("/api/example").json()["resume"]
    response = client.post("/resume/upload", files={"file": ("resume.txt", example, "text/plain")})
    assert response.status_code == 201
    return response.json()
