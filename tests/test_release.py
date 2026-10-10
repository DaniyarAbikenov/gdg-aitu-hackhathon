from uuid import uuid4

from sqlalchemy import func, select
from test_product import member

from app.infrastructure.career_store import TABLES, AccountRow
from app.infrastructure.postgres import ResumeRow

PASSWORD = "Product-test-password"


def application(client, **values):
    response = client.post(
        "/applications",
        json={
            "name": "Junior Backend Engineer",
            "company_name": "Library team",
            "description": "Build Python APIs with PostgreSQL and Docker.",
            "skills": ["Python", "PostgreSQL"],
            **values,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_application_context_resume_plan_and_owner_boundaries(client):
    member(client)
    item = application(client, follow_up="2026-11-01", next_action="Review resume")
    resume = client.post(
        "/resume/create",
        json={"title": "A" * 200, "vacancy_id": item["id"], "position": "Backend engineer"},
    ).json()["resume"]
    linked = client.get("/applications").json()[0]
    assert linked["data"]["resume_id"] == resume["resume_id"]
    assert linked["resume_title"] == "A" * 200
    assert linked["next_step"] == "Review resume"
    assert (
        client.put(f"/applications/{item['id']}", json={**item["data"], "revision": 1}).status_code
        == 422
    )  # timestamps are not editable
    updated = {
        k: v for k, v in linked["data"].items() if k not in {"updated_at", "stages", "rejection"}
    }
    response = client.put(
        f"/applications/{item['id']}",
        json={**updated, "revision": linked["revision"], "status": "applied"},
    )
    assert response.status_code == 200
    assert (
        client.put(
            f"/applications/{item['id']}", json={**updated, "revision": linked["revision"]}
        ).status_code
        == 409
    )
    plan = client.post(
        "/plan",
        json={
            "vacancy_id": item["id"],
            "position": "Backend",
            "goal": "Prepare for this role",
            "stacks": ["Python"],
        },
    )
    assert plan.status_code == 201
    assert plan.json()["data"]["vacancy_id"] == item["id"]
    assert plan.json()["data"]["resume_id"] == resume["resume_id"]
    assert client.get("/applications").json()[0]["plans"][0]["id"] == plan.json()["id"]
    client.post("/auth/logout")
    member(client)
    assert client.get("/applications").json() == []
    assert (
        client.put(
            f"/applications/{item['id']}", json={**updated, "resume_id": None, "revision": 3}
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/resume/create", json={"title": "Foreign", "vacancy_id": item["id"]}
        ).status_code
        == 404
    )
    assert (
        client.post("/plan", json={"goal": "Foreign plan", "vacancy_id": item["id"]}).status_code
        == 404
    )


def test_application_validation_and_foreign_resume(client):
    assert client.get("/applications").status_code == 401
    member(client)
    values = {
        "name": "Backend",
        "company_name": "Library",
        "description": "Build Python APIs",
        "source_url": "javascript:alert(1)",
    }
    assert client.post("/applications", json=values).status_code == 422
    assert (
        client.post(
            "/applications", json={**values, "source_url": None, "resume_id": str(uuid4())}
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/applications", json={**values, "source_url": None, "follow_up": "not-a-date"}
        ).status_code
        == 422
    )


def test_atomic_proposal_preserves_both_snapshots_and_rejects_stale_replay(client):
    member(client)
    profile = client.get("/user/profile").json()
    client.post(
        "/user/profile/update",
        json={"revision": 0, "profile": {**profile["data"], "summary": "I build reliable APIs"}},
    )
    resume = client.post("/resume/create", json={"title": "Resume"}).json()["resume"]
    rid = resume["resume_id"]
    result = client.post(
        f"/resume/{rid}/adapt",
        json={
            "revision": resume["revision"],
            "jd_text": "Build reliable Python services with PostgreSQL",
        },
    )
    proposal = result.json()["improvements"][0]
    request = {"revision": resume["revision"], "proposal_id": proposal["id"]}
    saved = client.post(f"/resume/{rid}/apply", json=request)
    assert saved.status_code == 200
    assert saved.json()["fields"]["summary"] == "I build reliable APIs"
    versions = client.get(f"/resume/{rid}/versions").json()
    assert len(versions) == 2
    assert {v["data"]["fields"]["summary"] for v in versions} == {"", "I build reliable APIs"}
    assert all("before" in v["data"] for v in versions)
    assert client.get(f"/resume/{rid}/assessment").json()["improvements"] == []
    assert client.post(f"/resume/{rid}/apply", json=request).status_code == 409
    assert len(client.get(f"/resume/{rid}/versions").json()) == 2
    before = next(v for v in versions if not v["data"]["fields"]["summary"])
    restored = client.post(
        f"/versions/{before['id']}/restore", json={"revision": saved.json()["revision"]}
    )
    assert restored.status_code == 200
    assert restored.json()["fields"]["summary"] == ""


def test_password_change_revokes_all_old_sessions_without_deleting_data(client, app):
    email = member(client)
    application(client)
    owner = app.state.container.sessions.resolve(client.cookies.get("career_session")).owner
    old_cookie = app.state.container.sessions.create("other-device", owner=owner)
    client.post("/auth/login", json={"email": email, "password": PASSWORD})
    second_cookie = client.cookies.get("career_session")
    assert (
        client.post(
            "/account/password",
            json={"password": "wrong password", "new_password": "Different-password-42"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/account/password",
            json={"password": PASSWORD, "new_password": "Different-password-42"},
        ).status_code
        == 204
    )
    for cookie in [old_cookie, second_cookie]:
        client.cookies.clear()
        client.cookies.set("career_session", cookie)
        assert client.get("/applications").status_code == 401
    client.cookies.clear()
    assert (
        client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 401
    )
    assert (
        client.post(
            "/auth/login", json={"email": email, "password": "Different-password-42"}
        ).status_code
        == 200
    )
    assert len(client.get("/applications").json()) == 1


def test_export_and_confirmed_deletion_preserve_other_accounts(client, app):
    email = member(client)
    application(client)
    client.post("/resume/create", json={"title": "Private"})
    response = client.get("/account/export")
    assert response.status_code == 200
    assert response.json()["email"] == email
    assert len(response.json()["resumes"]) == 1
    assert "password_hash" not in response.text
    assert client.delete("/session").status_code == 403
    assert len(client.get("/resume").json()) == 1
    cookie = client.cookies.get("career_session")
    owner = app.state.container.sessions.resolve(cookie).owner
    # Another account and shared reference data must survive private deletion.
    other_owner = str(uuid4())
    app.state.container.career_store.register(
        "other@example.com", "not-a-real-password", other_owner
    )
    assert (
        client.post(
            "/account/delete", json={"password": PASSWORD, "email": "wrong@example.com"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/account/delete", json={"password": "wrong password", "email": email}
        ).status_code
        == 403
    )
    assert (
        client.post("/account/delete", json={"password": PASSWORD, "email": email}).status_code
        == 204
    )
    client.cookies.set("career_session", cookie)
    assert client.get("/account/export").status_code == 401
    with app.state.container.repository.sessions() as db:
        assert db.get(AccountRow, owner) is None
        assert db.get(AccountRow, other_owner) is not None
        for table in [ResumeRow, *TABLES.values()]:
            assert (
                db.scalar(select(func.count()).select_from(table).where(table.owner == owner)) == 0
            )


def test_failed_atomic_apply_rolls_back_resume_versions_and_assessment(client, app, monkeypatch):
    import pytest

    import app.infrastructure.activity as activity

    member(client)
    profile = client.get("/user/profile").json()
    client.post(
        "/user/profile/update",
        json={"revision": 0, "profile": {**profile["data"], "summary": "A confirmed summary"}},
    )
    resume = client.post("/resume/create", json={"title": "Atomic rollback"}).json()["resume"]
    path = f"/resume/{resume['resume_id']}"
    client.post(
        path + "/adapt",
        json={
            "revision": resume["revision"],
            "jd_text": "Develop reliable Python APIs with PostgreSQL",
        },
    )
    calls = 0
    original = activity.record_activity

    def fail_second_snapshot(*args):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated write failure")
        return original(*args)

    monkeypatch.setattr(activity, "record_activity", fail_second_snapshot)
    with pytest.raises(RuntimeError, match="simulated write failure"):
        client.post(path + "/apply", json={"revision": resume["revision"], "proposal_id": "1"})
    assert client.get(path).json()["revision"] == resume["revision"]
    assert client.get(path).json()["fields"]["summary"] == ""
    assert client.get(path + "/versions").json() == []
    assert len(client.get(path + "/assessment").json()["improvements"]) == 1


def test_resume_exports_group_dates_and_omit_unknown_years():
    import io

    from docx import Document
    from pypdf import PdfReader

    from app.domain.models import ResumeFields
    from app.infrastructure.documents import Documents

    fields = ResumeFields(
        full_name="Demo Candidate",
        position="Engineer",
        education=[
            {
                "institution": "University",
                "degree": "Computer Science",
                "year_start": 2022,
                "year_end": 0,
            }
        ],
        experience=[
            {
                "company": "Library",
                "role": "Developer",
                "date_from": "2024-01",
                "date_to": "present",
                "location": "Remote",
                "responsibilities": "Build APIs",
                "achievements": ["Delivered a documented API"],
            }
        ],
        projects=[
            {
                "title": "Books",
                "description": "A personal project",
                "tech": ["Python", "PostgreSQL"],
            }
        ],
    )
    pdf = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(Documents().pdf(fields))).pages)
    word = "\n".join(p.text for p in Document(io.BytesIO(Documents().docx(fields))).paragraphs)
    for output in [pdf, word]:
        assert "Developer · Library" in output
        assert "2024-01 — present · Remote" in output
        assert "Computer Science · University" in output
        assert "Python · PostgreSQL" in output
        assert "2022 — 0" not in output
        assert "year_start" not in output
