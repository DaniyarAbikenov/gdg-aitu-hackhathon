import io
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from zipfile import ZipFile

import httpx
import pytest
from sqlalchemy import text

from app.application.auth import Administrators
from app.config import Settings
from app.domain.errors import InvalidDocument, ProviderUnavailable
from app.domain.models import ResumeFields
from app.infrastructure.documents import Documents, extract_text
from app.infrastructure.voice import RealtimeVoice


def allow_admins(client, emails):
    """Administrator allowlists are read once at startup; tests swap the parsed policy."""
    client.app.state.container.use_cases.auth.administrators = Administrators.parse(emails)


def member(client, email=None):
    email = email or f"{uuid4()}@example.com"
    client.post("/session")
    assert (
        client.post(
            "/auth/register", json={"email": email, "password": "Product-test-password"}
        ).status_code
        == 201
    )
    return email


def test_profile_resume_snapshots_metadata_docx_and_isolation(client):
    member(client)
    profile = client.get("/user/profile").json()
    fields = {
        **profile["data"],
        "full_name": "Alex Portfolio",
        "position": "Backend developer",
        "phone": "123",
        "location": "Almaty",
        "summary": "Build dependable backend APIs",
        "skills": ["Python"],
        "experience": [
            {
                "company": "Library",
                "role": "Developer",
                "date_from": "2023-01",
                "date_to": "2025-06",
                "location": "Remote",
                "responsibilities": "Build APIs",
                "achievements": ["Shipped a real service"],
            }
        ],
    }
    assert (
        client.post(
            "/user/profile/update", json={"profile": fields, "revision": profile["revision"]}
        ).status_code
        == 200
    )
    result = client.post(
        "/resume/create",
        json={
            "title": "Backend portfolio",
            "position": "Backend developer",
            "sections": ["experience", "summary", "skills"],
            "use_ai": False,
        },
    )
    assert result.status_code == 201
    resume = result.json()["resume"]
    id = resume["resume_id"]
    assert resume["fields"]["experience"][0]["location"] == "Remote"
    assert resume["fields"]["position"] == "Backend developer"
    assert resume["fields"]["full_name"] == "Alex Portfolio"
    assert (
        client.patch(
            f"/resume/{id}/metadata",
            json={
                "revision": resume["revision"],
                "title": "Archived draft",
                "description": "A specific role",
                "lifecycle": "archived",
            },
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/resume/{id}/metadata", json={"revision": resume["revision"], "title": "Stale"}
        ).status_code
        == 409
    )
    document = client.get(f"/resume/{id}/docx")
    assert document.status_code == 200
    text_value = extract_text("resume.docx", document.content)
    assert "Backend developer" in text_value and "Build APIs" in text_value
    r = client.get(f"/resume/{id}").json()
    version = client.post(
        f"/resume/{id}/versions",
        json={"revision": r["revision"], "fields": r["fields"], "label": "Snapshot"},
    ).json()
    assert client.get(f"/versions/{version['id']}/docx").content.startswith(b"PK")
    client.post("/auth/logout")
    member(client)
    assert client.get(f"/resume/{id}/docx").status_code == 404
    assert client.get(f"/versions/{version['id']}/docx").status_code == 404


def test_composer_clarifications_and_document_import(settings, client):
    settings.provider = "openai"
    settings.openai_api_key = Settings(_env_file=None, openai_api_key="test").openai_api_key
    settings.openai_model = "test-model"

    def response(value):
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": json.dumps(value)}],
                    }
                ],
            },
        )

    output = {
        "fields": {"full_name": "Alex", "position": "Engineer"},
        "questions": ["Which projects have you completed?"],
    }
    documents = Documents(settings, httpx.MockTransport(lambda r: response(output)))
    assert documents.compose({"full_name": "Alex"}, "Engineer", "", "")["questions"]
    client.app.state.container.use_cases.resumes.documents = documents
    member(client)
    result = client.post(
        "/resume/create", json={"title": "AI draft", "position": "Engineer", "use_ai": True}
    )
    assert result.json()["questions"]
    assert client.get("/resume").json() == []
    output["questions"] = []
    result = client.post(
        "/resume/create",
        json={
            "title": "AI draft",
            "position": "Engineer",
            "use_ai": True,
            "facts": "Built a library system",
        },
    )
    assert result.json()["resume"]["fields"]["position"] == "Engineer"
    fields = ResumeFields(full_name="Alex", position="Engineer", summary="Built a library system")
    data = documents.docx(fields)
    assert "Alex" in extract_text("resume.docx", data)
    with pytest.raises(InvalidDocument):
        extract_text("bad.docx", b"not a zip")
    oversized = io.BytesIO()
    with ZipFile(oversized, "w") as z:
        z.writestr("huge", b"x" * 30_000_001)
    with pytest.raises(InvalidDocument):
        extract_text("huge.docx", oversized.getvalue())
    unconfigured = Documents(Settings(_env_file=None))
    with pytest.raises(ProviderUnavailable):
        unconfigured.extract("resume.docx", data)
    with pytest.raises(ProviderUnavailable):
        unconfigured.compose({}, "Engineer", "", "")


def test_preferences_catalog_targets_and_dashboard(client, app):
    assert client.get("/overview").status_code == 401
    member(client)
    assert client.get("/preferences").json()["revision"] == 0
    pref = client.put("/preferences", json={"widgets": ["activity", "resumes", "resumes"]}).json()
    assert pref["data"]["widgets"] == ["activity", "resumes"]
    assert (
        client.put("/preferences", json={"widgets": [], "revision": pref["revision"]}).status_code
        == 200
    )
    assert (
        client.put(
            "/preferences", json={"widgets": ["skills"], "revision": pref["revision"]}
        ).status_code
        == 409
    )
    assert client.put("/preferences", json={"widgets": ["invalid"]}).status_code == 422
    company = client.post(
        "/targets/company", json={"name": "Library team", "description": "Open source library"}
    ).json()
    vacancy = client.post(
        "/targets/vacancy",
        json={
            "name": "Backend engineer",
            "description": "Python and PostgreSQL",
            "company_id": company["id"],
            "skills": ["Python"],
        },
    ).json()
    assert client.get("/targets/company").json()[0]["id"] == company["id"]
    assert client.get("/targets/vacancy").json()[0]["id"] == vacancy["id"]
    resume = client.post(
        "/resume/create", json={"title": "Draft", "position": "Engineer", "use_ai": True}
    ).json()["resume"]
    adapted = client.post(
        f"/resume/{resume['resume_id']}/adapt",
        json={
            "revision": resume["revision"],
            "jd_text": "Python developer using PostgreSQL and Redis for public APIs",
        },
    )
    assert adapted.status_code == 200
    assessment = client.get(f"/resume/{resume['resume_id']}/assessment").json()
    assert "Python" in assessment["missing_skills"]
    overview = client.get("/overview", params={"offset": 300}).json()
    assert overview["reviewed_resumes"] == 1 and overview["resumes"] == 1
    assert overview["xp"] == 30 and overview["week"]["current"] == 2
    assert overview["skill_gaps"]
    client.post("/auth/logout")
    member(client)
    assert client.get("/targets/company").json() == []
    assert (
        client.post(
            "/targets/vacancy", json={"name": "Other", "company_id": company["id"]}
        ).status_code
        == 404
    )
    assert client.get("/overview").json()["xp"] == 0
    assert client.get(f"/resume/{resume['resume_id']}/assessment").status_code == 404


def test_learning_activity_idempotency_and_calendar(client, app):
    member(client)
    plan = client.post(
        "/plan",
        json={
            "goal": "Backend engineer",
            "position": "Backend",
            "stacks": ["Python", "PostgreSQL"],
        },
    ).json()
    assert plan["data"]["stacks"] == ["Python", "PostgreSQL"]
    for completed in [True, False, True]:
        r = client.post(
            f"/plan/{plan['id']}/modules/1",
            json={
                "revision": plan["revision"],
                "completed": completed,
                "evidence": "Tested a real API",
            },
        )
        assert r.status_code == 200
        plan = r.json()
    stats = client.get("/overview").json()
    assert stats["xp"] == 25 and stats["week"]["learning_current"] == 1
    owner = client.get("/user/me").json()["uid"]
    with app.state.container.repository.engine.begin() as db:
        db.execute(
            text("UPDATE career_activity SET created_at = :old WHERE owner = :owner"),
            {"old": datetime.now(UTC) - timedelta(days=7), "owner": owner},
        )
    stats = client.get("/overview").json()
    assert stats["week"]["learning_previous"] == 1 and stats["week"]["learning_current"] == 0
    assert len(stats["activity"]) == 14


def test_knowledge_admin_authorization_drafts_and_conflicts(client, settings):
    email = member(client)
    assert client.get("/capabilities").json()["admin"] is False
    assert client.get("/admin/knowledge").status_code == 403
    assert len(client.get("/knowledge").json()) >= 8
    allow_admins(client, email)
    assert client.get("/capabilities").json()["admin"] is True
    value = {
        "title": f"Article {uuid4()}",
        "category": "Tests",
        "body": "A draft with meaningful content for the article.",
        "published": False,
    }
    draft = client.post("/admin/knowledge", json=value).json()
    assert draft["revision"] == 1
    assert not client.get("/knowledge", params={"q": value["title"]}).json()
    published = client.put(
        "/admin/knowledge/" + draft["id"], json={**value, "published": True, "revision": 1}
    )
    assert published.status_code == 200
    assert client.get("/knowledge", params={"q": value["title"]}).json()[0]["published"]
    assert (
        client.put("/admin/knowledge/" + draft["id"], json={**value, "revision": 1}).status_code
        == 409
    )
    assert (
        client.put("/admin/knowledge/" + str(uuid4()), json={**value, "revision": 1}).status_code
        == 404
    )
    client.post("/auth/logout")
    member(client)
    assert client.get("/admin/knowledge").status_code == 403
    assert (
        client.put("/admin/knowledge/" + draft["id"], json={**value, "revision": 2}).status_code
        == 403
    )


def voice_settings():
    return Settings(
        _env_file=None,
        openai_api_key="test-secret",
        openai_realtime_model="configured-realtime",
        openai_transcription_model="configured-transcription",
    )


def test_voice_signalling_and_failure_contract():
    requests = []

    def transport(request):
        requests.append(request)
        if str(request.url).endswith("/hangup"):
            return httpx.Response(200)
        assert request.headers["authorization"] == "Bearer test-secret"
        assert b"configured-realtime" in request.content and b"server_vad" in request.content
        return httpx.Response(
            201, text="v=0\r\nanswer", headers={"location": "/v1/realtime/calls/rtc_test"}
        )

    voice = RealtimeVoice(voice_settings(), httpx.MockTransport(transport))
    assert voice.connect("v=0 offer", {"language": "ru"}, [])["call_id"] == "rtc_test"
    voice.stop("rtc_test")
    assert len(requests) == 2
    with pytest.raises(ProviderUnavailable):
        voice.stop("../bad")
    with pytest.raises(ProviderUnavailable):
        RealtimeVoice(Settings(_env_file=None)).connect("offer", {}, [])
    with pytest.raises(ProviderUnavailable):
        RealtimeVoice(voice_settings(), httpx.MockTransport(lambda r: httpx.Response(429))).connect(
            "offer", {}, []
        )
    with pytest.raises(ProviderUnavailable):
        RealtimeVoice(voice_settings(), httpx.MockTransport(lambda r: httpx.Response(500))).stop(
            "rtc_test"
        )


def test_voice_transcript_persists_finish_evaluation_and_ownership(client, app):
    member(client)
    app.state.container.use_cases.voice.voice = RealtimeVoice(
        voice_settings(),
        httpx.MockTransport(
            lambda r: httpx.Response(
                200, text="v=0 answer", headers={"location": "/v1/realtime/calls/rtc_test"}
            )
        ),
    )
    context = {
        "company_description": "Library team",
        "job_description": "Python developer with APIs",
        "tech_stack": "Python",
        "mode": "voice",
        "style": "mixed",
        "modes": ["theoretical", "practical"],
        "company_name": "Library",
        "vacancy_title": "Developer",
    }
    interview = client.post("/interview/start", json=context).json()
    id = interview["id"]
    offer = client.post(
        f"/interview/{id}/voice/connect",
        json={"revision": interview["revision"], "sdp": "v=0 test offer sdp"},
    )
    assert offer.status_code == 200 and "call_id" not in offer.json()
    turns = [
        {"id": "assistant:1", "role": "assistant", "text": "Explain your approach?"},
        {
            "id": "user:2",
            "role": "user",
            "text": "I test correctness and explain reasoning with clarity.",
        },
    ]
    saved = client.post(
        f"/interview/{id}/voice/transcript",
        json={"revision": offer.json()["revision"], "turns": turns},
    ).json()
    assert len(saved["transcript"]) == 2
    again = client.post(
        f"/interview/{id}/voice/transcript", json={"revision": saved["revision"], "turns": turns}
    ).json()
    assert len(again["transcript"]) == 2
    assert (
        client.post(
            f"/interview/{id}/voice/transcript",
            json={"revision": saved["revision"], "turns": turns},
        ).status_code
        == 409
    )
    final = client.post(
        f"/interview/{id}/voice/transcript",
        json={"revision": again["revision"], "turns": turns, "finish": True},
    ).json()
    assert final["finished"] and final["answers"][0]["score"] >= 0
    assert client.get("/overview").json()["interviews_completed"] == 1
    assert client.post(f"/interview/{id}/voice/stop").status_code == 204
    assert (
        client.post(
            f"/interview/{id}/voice/connect",
            json={"revision": final["revision"], "sdp": "v=0 test offer sdp"},
        ).status_code
        == 409
    )
    client.post("/auth/logout")
    member(client)
    assert client.post(f"/interview/{id}/voice/stop").status_code == 404


def test_admin_address_cannot_be_claimed_through_registration(client, settings):
    allow_admins(client, "admin@a2d.local")
    response = client.post(
        "/auth/register", json={"email": "admin@a2d.local", "password": "some long password"}
    )
    assert response.status_code == 403
