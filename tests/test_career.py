"""Connected workflows against real PostgreSQL/Redis, including owner isolation."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.domain.errors import ProviderUnavailable
from app.infrastructure.coach import Coach
from app.infrastructure.passwords import ScryptPasswords

CONTEXT = {
    "company_description": "Library team",
    "job_description": "Python backend developer for public APIs",
    "tech_stack": "Python, PostgreSQL",
    "style": "practical",
    "language": "en",
}


def test_profile_versions_and_personalized_adaptation(client, resume):
    profile = client.get("/user/profile").json()
    profile["data"].update(
        full_name="Alex",
        desired_position="Backend developer",
        career_goal="Build reliable APIs",
        summary="My verified introduction",
        skills=["Docker", "Python"],
        projects="A library project",
        certificates="A verified certificate",
        phone="+123456789",
    )
    saved = client.post("/user/profile/update", json={"profile": profile["data"], "revision": 0})
    assert saved.status_code == 200
    assert (
        client.post(
            "/user/profile/update", json={"profile": profile["data"], "revision": 0}
        ).status_code
        == 409
    )
    assert client.get("/user/profile").json()["data"]["phone"] == "+123456789"
    fields = resume["fields"] | {"summary": "", "skills": ["Docker", "Python"]}
    edited = client.post(
        f"/resume/{resume['resume_id']}/save", json={"fields": fields, "revision": 1}
    ).json()
    job = "Python developer building and testing public APIs"
    adapted = client.post(
        f"/resume/{resume['resume_id']}/adapt",
        json={"revision": edited["revision"], "jd_text": job},
    )
    assert adapted.status_code == 200
    changes = adapted.json()["improvements"]
    assert {c["section"] for c in changes} == {"skills", "summary"}
    for change in changes:
        fields[change["section"]] = (
            change["after"].split(", ") if change["section"] == "skills" else change["after"]
        )
    version = client.post(
        f"/resume/{resume['resume_id']}/versions",
        json={
            "revision": edited["revision"],
            "fields": fields,
            "label": "Python role",
            "jd_text": job,
        },
    ).json()
    assert client.get(f"/versions/{version['id']}/pdf").content.startswith(b"%PDF-")
    assert len(client.get(f"/resume/{resume['resume_id']}/versions").json()) == 1
    restored = client.post(
        f"/versions/{version['id']}/restore", json={"revision": edited["revision"]}
    )
    assert restored.json()["fields"]["summary"] == "My verified introduction"
    assert (
        client.post(
            f"/versions/{version['id']}/restore", json={"revision": edited["revision"]}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/resume/{resume['resume_id']}/adapt", json={"revision": 1, "jd_text": job}
        ).status_code
        == 409
    )
    assert client.delete(f"/career/version/{version['id']}").status_code == 204


def finish_interview(client):
    interview = client.post("/interview/start", json=CONTEXT).json()
    assert "reference_answer" not in json.dumps(interview)
    assert interview["total_questions"] == 3
    for answer in [
        "The problem was latency. My contribution was a cache decision. The result was measured.",
        "State assumptions, an approach, compare alternatives and verify.",
        "I test failure cases, monitor behavior and prepare rollback.",
    ]:
        old_revision = interview["revision"]
        result = client.post(
            f"/interview/{interview['id']}/answer",
            json={"revision": old_revision, "answer": answer},
        )
        assert result.status_code == 200
        interview = result.json()
        assert (
            client.post(
                f"/interview/{interview['id']}/answer",
                json={"revision": old_revision, "answer": answer},
            ).status_code
            == 409
        )
    assert interview["finished"]
    assert interview["score"] == 100
    assert all(a["reference_answer"] for a in interview["answers"])
    assert client.get(f"/interview/{interview['id']}").json() == interview
    return interview


def test_interview_plan_progress_and_rewards(client, resume):
    interview = finish_interview(client)
    assert client.get("/interview").json()[0]["id"] == interview["id"]
    client.post(
        f"/resume/{resume['resume_id']}/improve",
        json={"revision": 1, "jd_text": "We need Python and Kubernetes for production services"},
    )
    plan = client.post(
        "/plan",
        json={
            "goal": "Backend engineering",
            "resume_id": resume["resume_id"],
            "interview_id": interview["id"],
        },
    ).json()
    assert len(plan["data"]["modules"]) == 8
    assert "Kubernetes" in plan["data"]["modules"][0]["title"]
    assert client.post("/progress/rewards/first-step").status_code == 422
    for module_id in range(1, 6):
        result = client.post(
            f"/plan/{plan['id']}/modules/{module_id}",
            json={
                "revision": plan["revision"],
                "completed": True,
                "evidence": "Implemented and tested the exercise",
            },
        )
        assert result.status_code == 200
        plan = result.json()
    assert (
        client.post(
            f"/plan/{plan['id']}/modules/1", json={"revision": 1, "completed": False}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/plan/{plan['id']}/modules/99",
            json={"revision": plan["revision"], "completed": False},
        ).status_code
        == 404
    )
    assert client.get("/plan").json()[0]["data"]["modules"][0]["completed"]
    exported = client.get(f"/plan/{plan['id']}/export")
    assert "Implemented and tested" in exported.text
    assert "attachment" in exported.headers["content-disposition"]
    progress = client.get("/progress").json()
    assert progress["completed_modules"] == 5 and progress["average_score"] == 100
    assert client.post("/progress/rewards/first-step").status_code == 201
    assert client.post("/progress/rewards/first-step").status_code == 409
    assert client.post("/progress/rewards/unknown").status_code == 422
    assert client.delete(f"/career/plan/{plan['id']}").status_code == 204
    assert client.get("/progress").json()["total_modules"] == 0
    assert client.delete(f"/career/interview/{interview['id']}").status_code == 204


def test_account_preserves_records_across_sessions(client, resume, app):
    credentials = {"email": "Alex@example.com", "password": "a long test password"}
    old_cookie = client.cookies.get("career_session")
    assert client.post("/auth/register", json=credentials).status_code == 201
    assert client.cookies.get("career_session") != old_cookie
    assert client.get("/user/me").json()["authenticated"]
    assert client.post("/auth/register", json=credentials).status_code == 422
    # Persisted account data survives guest cleanup and a fresh sign-in.
    app.state.repository.purge_expired(datetime.now(UTC) + timedelta(days=8))
    assert client.get(f"/resume/{resume['resume_id']}").status_code == 200
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/resume").status_code == 401
    assert (
        client.post(
            "/auth/login", json=credentials | {"password": "incorrect password"}
        ).status_code
        == 401
    )
    assert (
        client.post("/auth/login", json=credentials | {"email": "unknown@example.com"}).status_code
        == 401
    )
    assert client.post("/auth/login", json=credentials).status_code == 200
    assert client.get(f"/resume/{resume['resume_id']}").status_code == 200
    client.post("/auth/logout")
    client.post("/api/session")
    assert client.post("/auth/register", json=credentials).status_code == 409
    assert (
        client.post("/auth/register", json={"email": "invalid", "password": "short"}).status_code
        == 422
    )


def test_career_owner_isolation_expiration_and_clear(client, app, resume):
    interview = client.post("/interview/start", json=CONTEXT).json()
    plan = client.post("/plan", json={"goal": "Backend engineering"}).json()
    version = client.post(
        f"/resume/{resume['resume_id']}/versions",
        json={"revision": 1, "fields": resume["fields"], "label": "Original"},
    ).json()
    with TestClient(app) as other:
        other.post("/api/session")
        assert other.get(f"/interview/{interview['id']}").status_code == 404
        assert (
            other.post(
                f"/interview/{interview['id']}/answer", json={"revision": 1, "answer": "My answer"}
            ).status_code
            == 404
        )
        assert other.get(f"/plan/{plan['id']}/export").status_code == 404
        assert other.get(f"/versions/{version['id']}/pdf").status_code == 404
        assert other.delete(f"/career/interview/{interview['id']}").status_code == 404
    # TestClient lifecycle creates a fresh repository for the same real services.
    assert client.delete("/api/session").status_code == 204
    client.post("/api/session")
    assert client.get("/plan").json() == []
    assert client.get("/interview").json() == []
    app.state.career.store.purge_expired(datetime.now(UTC) + timedelta(days=8))


def test_password_hashes_and_auth_rate_limits(client):
    passwords = ScryptPasswords()
    first = passwords.hash(" password with spaces ")
    second = passwords.hash(" password with spaces ")
    assert first != second
    assert passwords.verify(" password with spaces ", first)
    assert not passwords.verify("password with spaces", first)
    assert not passwords.verify("anything", "bad-format")
    assert not passwords.verify("anything", "other$00$00")
    for _ in range(15):
        client.app.state.sessions.consume_auth("testclient")
    assert (
        client.post(
            "/auth/login", json={"email": "alex@example.com", "password": "a long test password"}
        ).status_code
        == 429
    )


@pytest.mark.parametrize("provider", ["gemini", "openai"])
def test_all_coaching_contracts(provider):
    settings = Settings(
        _env_file=None,
        provider=provider,
        gemini_api_key="fake",
        gemini_model="test",
        openai_api_key="fake",
        openai_model="test",
    )
    requests = []
    responses = [
        {
            "improvements": [
                {
                    "section": "summary",
                    "before": "Original",
                    "after": "Clearer original",
                    "reason": "Clearer phrasing",
                }
            ]
        },
        {
            "questions": [
                {
                    "question": "Explain a technical decision?",
                    "reference_answer": "Describe a decision with tradeoffs.",
                    "criteria": ["tradeoffs"],
                }
            ]
            * 3
        },
        {
            "score": 75,
            "feedback": "Explain a tradeoff in more depth.",
            "strengths": ["Specific example"],
            "improvements": ["Compare alternatives"],
        },
        {
            "explanation": "A plan based on your goal",
            "modules": [
                {
                    "title": "API design",
                    "goals": ["Design a route"],
                    "exercise": "Implement a tested route",
                    "hours": 5,
                    "resource_topic": "FastAPI documentation",
                }
            ]
            * 8,
        },
    ]

    def handler(request):
        requests.append(json.loads(request.content))
        answer = json.dumps(responses.pop(0))
        payload = (
            {"candidates": [{"content": {"parts": [{"text": answer}]}}]}
            if provider == "gemini"
            else {
                "status": "completed",
                "output": [
                    {"type": "message", "content": [{"type": "output_text", "text": answer}]}
                ],
            }
        )
        return httpx.Response(200, json=payload)

    coach = Coach(settings, httpx.MockTransport(handler))
    fields = {"summary": "Original", "skills": []}
    assert (
        coach.improvements(fields, {"career_goal": "Backend"}, "Python job")["provider"] == provider
    )
    questions = coach.questions(CONTEXT)
    assert len(questions["questions"]) == 3
    assert coach.evaluate(CONTEXT, questions["questions"][0], "My answer")["score"] == 75
    assert len(coach.plan({}, "Backend", [])["modules"]) == 8
    assert "Backend" in json.dumps(requests[0])
    failed = Coach(settings, httpx.MockTransport(lambda r: httpx.Response(503)))
    with pytest.raises(ProviderUnavailable):
        failed.questions(CONTEXT)
    malformed = Coach(
        settings,
        httpx.MockTransport(
            lambda r: httpx.Response(
                200, json={"candidates": [{"content": {"parts": [{"text": '{"questions": []}'}]}}]}
            )
        ),
    )
    with pytest.raises(ProviderUnavailable):
        malformed.questions(CONTEXT)


def test_google_nonce_identity_and_replay_protection(client, settings, monkeypatch):
    settings.google_client_id = "test-client"
    monkeypatch.setattr(
        client.app.state.google_login,
        "verify",
        lambda credential, nonce: {"subject": "google-123", "email": "google@example.com"},
    )
    assert client.get("/auth/options").json()["google"]
    challenge = client.post("/auth/google/nonce").json()
    assert len(challenge["nonce"]) > 30
    assert (
        client.post("/auth/google", json={"credential": "test-google-token-12345"}).status_code
        == 200
    )
    assert client.get("/user/me").json()["authenticated"]
    assert client.post("/auth/google/nonce").status_code == 409
    assert (
        client.post("/auth/google", json={"credential": "test-google-token-12345"}).status_code
        == 409
    )
    client.post("/auth/logout")
    client.post("/api/session")
    assert (
        client.post("/auth/google", json={"credential": "test-google-token-12345"}).status_code
        == 401
    )
    client.post("/auth/google/nonce")
    assert (
        client.post("/auth/google", json={"credential": "test-google-token-12345"}).status_code
        == 200
    )


def test_google_verifier_validates_nonce_and_claims(monkeypatch):
    from app.domain.errors import NotFound
    from app.infrastructure.google_login import GoogleLogin

    claims = {
        "email_verified": True,
        "email": "Alex@example.com",
        "sub": "123",
        "nonce": "expected",
    }
    monkeypatch.setattr(
        "app.infrastructure.google_login.id_token.verify_oauth2_token",
        lambda token, request, audience: claims,
    )
    assert GoogleLogin("client").verify("credential", "expected")["email"] == "alex@example.com"
    with pytest.raises(NotFound):
        GoogleLogin("client").verify("credential", "wrong")
    with pytest.raises(ProviderUnavailable):
        GoogleLogin("").verify("credential", "expected")
    claims["email_verified"] = False
    with pytest.raises(NotFound):
        GoogleLogin("client").verify("credential", "expected")


def test_gemini_resume_extraction_and_pdf_styles(client, resume):
    import io

    from pypdf import PdfReader

    from app.domain.models import ResumeFields
    from app.infrastructure.documents import Documents, render_pdf

    settings = Settings(
        _env_file=None, provider="gemini", gemini_api_key="test", gemini_model="test"
    )
    fields = ResumeFields(
        full_name="Alex",
        summary="A factual profile",
        phone="123",
        experience=[],
        education=[],
        projects=[
            {"title": "A real project", "description": "A factual result", "tech": ["Python"]}
        ],
    )
    from dataclasses import asdict

    captured = []

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": json.dumps(asdict(fields))}]}}]},
        )

    docs = Documents(settings, httpx.MockTransport(handler))
    assert docs.extract("resume.pdf", render_pdf(fields)) == fields
    assert "inline_data" in captured[0]["contents"][0]["parts"][1]
    for style in ["modern", "classic", "minimalist"]:
        pdf = client.get(f"/resume/{resume['resume_id']}/pdf", params={"template": style})
        assert pdf.status_code == 200
        assert "Alex Morgan" in PdfReader(io.BytesIO(pdf.content)).pages[0].extract_text()
    assert (
        client.get(f"/resume/{resume['resume_id']}/pdf", params={"template": "unknown"}).status_code
        == 422
    )


def test_structured_resume_roundtrip_versions_and_profile(client, resume):
    import io

    from pypdf import PdfReader

    fields = {
        **resume["fields"],
        "experience": [
            {
                "company": "Library",
                "role": "Developer",
                "date_from": "2024",
                "date_to": "2025",
                "achievements": ["Built a Python API"],
            }
        ],
        "education": [
            {"institution": "University", "degree": "BSc", "year_start": 2020, "year_end": 2024}
        ],
        "projects": [
            {"title": "CareerBot", "description": "Resume editor", "tech": ["React", "FastAPI"]}
        ],
    }
    path = "/resume/" + resume["resume_id"]
    saved = client.post(path + "/save", json={"fields": fields, "revision": resume["revision"]})
    assert saved.status_code == 200
    assert client.get(path).json()["fields"] == fields
    version = client.post(
        path + "/versions",
        json={"fields": fields, "revision": saved.json()["revision"], "label": "Structured"},
    )
    assert version.status_code == 201
    pdf = client.get("/versions/" + version.json()["id"] + "/pdf")
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages)
    assert all(
        value in text for value in ["Library", "University", "CareerBot", "Built a Python API"]
    )
    profile = client.get("/user/profile").json()
    profile["data"]["extra"] = {"languages": ["English", "Kazakh"], "normalized_skills": ["python"]}
    assert (
        client.post(
            "/user/profile/update",
            json={"profile": profile["data"], "revision": profile["revision"]},
        ).status_code
        == 200
    )
    assert client.get("/user/profile").json()["data"]["extra"] == profile["data"]["extra"]


def test_unconfigured_ai_never_substitutes_demo():
    from app.domain.errors import ProviderUnavailable
    from app.domain.models import ResumeFields
    from app.infrastructure.reviewer import Reviewer

    settings = Settings(_env_file=None)
    assert settings.provider == "unconfigured"
    coach = Coach(settings)
    for operation in [
        lambda: coach.questions({}),
        lambda: coach.evaluate({}, {}, "answer"),
        lambda: coach.plan({}, "goal", []),
        lambda: coach.improvements({}, {}, "job"),
        lambda: Reviewer(settings).analyze(ResumeFields(), "job"),
    ]:
        with pytest.raises(ProviderUnavailable):
            operation()
