import io
from datetime import UTC, datetime, timedelta

import pytest
from pypdf import PdfReader
from sqlalchemy import select, update

from app.domain.errors import Conflict, NotFound
from app.infrastructure.postgres import ResumeRow
from app.presentation.api import COOKIE

JOB = "Build Python and FastAPI APIs using PostgreSQL, Docker and Kubernetes."


def test_complete_resume_workflow(client, resume):
    assert resume["fields"]["full_name"] == "Alex Morgan"
    assert "Python" in resume["fields"]["skills"]
    assert client.get("/resume").json()[0]["resume_id"] == resume["resume_id"]
    path = "/resume/" + resume["resume_id"]
    fields = resume["fields"]
    fields["full_name"] = "Данияр <Developer>"
    fields["experience"] += "\nDelivered 12 documented endpoints."
    saved = client.post(path + "/save", json={"fields": fields, "revision": 1})
    assert saved.status_code == 200
    assert saved.json()["revision"] == 2
    analyzed = client.post(path + "/improve", json={"jd_text": JOB, "revision": 2})
    assert analyzed.status_code == 200
    data = analyzed.json()
    assert data["status"] == "reviewed"
    assert data["analysis"]["provider"] == "local"
    assert "Kubernetes" in data["analysis"]["missing_skills"]
    assert "Kubernetes" not in data["fields"]["skills"]
    pdf = client.get(path + "/pdf")
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-")
    text = "".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf.content)).pages)
    assert "Данияр <Developer>" in text
    assert "12 documented endpoints" in text
    assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404
    assert client.get("/resume").json() == []


def test_changes_invalidate_old_review_and_job_is_not_stale(client, resume):
    path = "/resume/" + resume["resume_id"]
    first = client.post(path + "/improve", json={"jd_text": JOB, "revision": 1}).json()
    second = client.post(
        path + "/improve",
        json={
            "jd_text": "Build Java and Spring applications for an enterprise platform.",
            "revision": first["revision"],
        },
    ).json()
    assert "Java" in second["analysis"]["missing_skills"]
    assert "Python" not in second["analysis"]["matched_skills"]
    saved = client.post(
        path + "/save",
        json={
            "fields": second["fields"],
            "revision": second["revision"],
        },
    ).json()
    assert saved["analysis"] is None and saved["jd_text"] == ""
    assert saved["status"] == "edited"


def test_two_tabs_cannot_overwrite_newer_changes(client, resume):
    path = "/resume/" + resume["resume_id"] + "/save"
    payload = {"fields": resume["fields"], "revision": 1}
    assert client.post(path, json=payload).status_code == 200
    assert client.post(path, json=payload).status_code == 409


def test_resume_is_private_to_its_session(client, resume):
    original = client.cookies[COOKIE]
    client.cookies.clear()
    assert client.get("/resume").status_code == 401
    client.post("/api/session")
    path = "/resume/" + resume["resume_id"]
    assert client.get(path).status_code == 404
    assert client.get(path + "/pdf").status_code == 404
    assert (
        client.post(path + "/save", json={"fields": resume["fields"], "revision": 1}).status_code
        == 404
    )
    assert client.delete(path).status_code == 404
    client.cookies.clear()
    client.cookies.set(COOKIE, original)
    assert client.get(path).status_code == 200


def test_session_cookie_and_clear_workspace(client, app, resume):
    token = client.cookies[COOKIE]
    assert token not in app.state.sessions.client.keys("*session*")
    assert client.post("/api/session").status_code == 200
    assert client.cookies[COOKIE] == token
    assert client.delete("/api/session").status_code == 204
    assert client.get("/resume").status_code == 401
    with app.state.repository.sessions() as db:
        assert list(db.scalars(select(ResumeRow))) == []


def test_expired_session_cannot_access_records(client, app, resume):
    app.state.sessions.delete(client.cookies[COOKIE])
    assert client.get("/resume/" + resume["resume_id"]).status_code == 401


def test_expired_records_are_hidden_and_removed(client, app, resume):
    with app.state.repository.sessions.begin() as db:
        db.execute(update(ResumeRow).values(expires_at=datetime.now(UTC) - timedelta(hours=1)))
    assert client.get("/resume").json() == []
    assert app.state.repository.purge_expired(datetime.now(UTC)) == 1


def test_analysis_limit_is_shared_and_unchanged_review_is_reused(client, app, resume):
    app.state.sessions.analysis_limit = 1
    path = "/resume/" + resume["resume_id"] + "/improve"
    first = client.post(path, json={"jd_text": JOB, "revision": 1}).json()
    repeat = client.post(path, json={"jd_text": JOB, "revision": first["revision"]})
    assert repeat.json()["revision"] == first["revision"]
    assert (
        client.post(
            path,
            json={
                "jd_text": JOB + " Linux required.",
                "revision": first["revision"],
            },
        ).status_code
        == 429
    )


def test_workspace_upload_quota(client):
    for i in range(20):
        assert (
            client.post(
                "/resume/upload",
                files={
                    "file": (f"{i}.txt", "Alex Morgan\nPython developer with API experience."),
                },
            ).status_code
            == 201
        )
    assert (
        client.post(
            "/resume/upload",
            files={
                "file": ("extra.txt", "Alex Morgan\nPython developer with API experience."),
            },
        ).status_code
        == 429
    )


def test_schema_validation_and_error_redaction(client, resume):
    path = "/resume/" + resume["resume_id"]
    assert (
        client.post(path + "/improve", json={"jd_text": "short", "revision": 1}).status_code == 422
    )
    fields = {**resume["fields"], "unknown_secret": "do-not-echo-me"}
    response = client.post(path + "/save", json={"fields": fields, "revision": 1})
    assert response.status_code == 422
    assert "do-not-echo-me" not in response.text
    assert client.get("/resume/not-a-uuid").status_code == 422


def test_security_headers_and_origin_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert (
        client.post("/api/session", headers={"Origin": "https://elsewhere.example"}).status_code
        == 403
    )
    assert client.post("/api/session", headers={"Origin": "http://testserver"}).status_code == 200
    assert client.get("/static/font").status_code == 200
    assert client.get("/health").json()["status"] == "ok"


@pytest.mark.parametrize(
    "filename,data",
    [
        ("bad.exe", b"not a resume, just some random text"),
        ("bad.pdf", b"not a real pdf"),
        ("empty.txt", b""),
        ("bad.txt", b"\xff\xfe\x00"),
        ("long.txt", b"a" * 30001),
    ],
)
def test_invalid_uploads(client, filename, data):
    assert client.post("/resume/upload", files={"file": (filename, data)}).status_code == 422


def test_upload_size_limit_with_and_without_content_length(client):
    assert (
        client.post(
            "/resume/upload",
            files={
                "file": ("large.txt", b"x" * (5 * 1024 * 1024 + 1)),
            },
        ).status_code
        == 413
    )
    response = client.post("/resume/upload", content=iter([b"x" * 1_100_000] * 5))
    assert response.status_code == 413


def test_optimistic_check_after_slow_provider(client, app, resume):
    repository = app.state.repository
    owner = app.state.sessions.resolve(client.cookies[COOKIE]).owner
    record = repository.get(owner, resume["resume_id"])
    repository.save(owner, record.resume_id, record.revision, record.fields)
    from app.domain.review import compare

    with pytest.raises(Conflict):
        repository.review(
            owner, record.resume_id, record.revision, compare(record.fields, JOB), JOB
        )
    with pytest.raises(NotFound):
        app.state.sessions.resolve("x" * 101)


def test_provider_failure_preserves_saved_resume(client, app, resume, monkeypatch):
    from app.domain.errors import ProviderUnavailable

    def fail(*args):
        raise ProviderUnavailable

    monkeypatch.setattr(app.state.service.reviewer, "analyze", fail)
    path = "/resume/" + resume["resume_id"]
    result = client.post(path + "/improve", json={"jd_text": JOB, "revision": 1})
    assert result.status_code == 502
    assert client.get(path).json()["revision"] == 1
    assert client.get(path + "/pdf").status_code == 200


def test_session_creation_is_rate_limited_in_redis(client, app):
    for _ in range(29):
        app.state.sessions.create("testclient")
    client.cookies.clear()
    assert client.post("/api/session").status_code == 429
