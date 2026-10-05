import base64
import json
from pathlib import Path

import httpx
import pytest
from test_openai import completed, config
from test_product import member

from app.domain.periods import normalize_period, validate_period
from app.infrastructure.documents import Documents


@pytest.mark.parametrize(
    "source,expected,end",
    [
        ("2024", "2024", False),
        ("2024-02", "2024-02", False),
        ("02.2024", "2024-02", False),
        ("2024-02-29", "2024-02", False),
        ("по настоящее время", "present", True),
        ("", "", False),
    ],
)
def test_period_precision(source, expected, end):
    assert normalize_period(source, end=end) == expected


@pytest.mark.parametrize("value", ["2024-02-31", "2024-13", "2024-00", "1899"])
def test_invalid_dates_rejected(value):
    with pytest.raises(ValueError):
        normalize_period(value)


@pytest.mark.parametrize("start,end", [("2025-02", "2025-01"), ("2026", "2025")])
def test_reverse_period_rejected(start, end):
    with pytest.raises(ValueError):
        validate_period(start, end)


def test_profile_dates_are_validated_but_legacy_records_remain_readable(client, app):
    member(client)
    current = client.get("/user/profile").json()
    invalid = {
        **current["data"],
        "experience": [{"role": "Developer", "date_from": "2025-02", "date_to": "2024-12"}],
    }
    assert (
        client.post("/user/profile/update", json={"profile": invalid, "revision": 0}).status_code
        == 422
    )
    invalid["experience"][0]["date_from"] = "2024-13"
    assert (
        client.post("/user/profile/update", json={"profile": invalid, "revision": 0}).status_code
        == 422
    )
    invalid["experience"][0].update(date_from="2024-02", date_to="present")
    saved = client.post("/user/profile/update", json={"profile": invalid, "revision": 0})
    assert saved.status_code == 200
    assert client.get("/user/profile").json()["data"]["experience"][0]["date_to"] == "present"
    invalid["education"] = [{"institution": "University", "year_start": 2024, "year_end": 2020}]
    assert (
        client.post("/user/profile/update", json={"profile": invalid, "revision": 1}).status_code
        == 422
    )
    # Legacy free-text periods must remain readable through the resume response contract.
    resume = client.post(
        "/resume/create", json={"title": "Historical record", "sections": ["experience"]}
    ).json()["resume"]
    from app.domain.models import ResumeFields

    owner = client.get("/user/me").json()["uid"]
    original = app.state.repository.get(owner, resume["resume_id"])
    fields = {
        **resume["fields"],
        "experience": [
            {"role": "Developer", "date_from": "Spring of 2020", "date_to": "Autumn of 2021"}
        ],
    }
    app.state.repository.save(owner, original.resume_id, original.revision, ResumeFields(**fields))
    response = client.get(f"/resume/{resume['resume_id']}")
    assert response.status_code == 200
    assert response.json()["fields"]["experience"][0]["date_from"] == "Spring of 2020"
    assert (
        client.post(
            f"/resume/{resume['resume_id']}/save", json={"fields": fields, "revision": 2}
        ).status_code
        == 422
    )


def test_pdf_profile_import_sends_document_to_ai_and_never_mutates_profile(client, app):
    pdf = Path("tests/fixtures/resume.pdf").read_bytes()
    assert (
        client.post(
            "/user/profile/import", files={"file": ("resume.pdf", pdf, "application/pdf")}
        ).status_code
        == 401
    )
    member(client)
    before = client.get("/user/profile").json()
    facts = {
        "full_name": "PDF Candidate",
        "position": "Backend engineer",
        "skills": ["Python"],
        "experience": [
            {
                "company": "Library",
                "role": "Engineer",
                "date_from": "2022-03",
                "date_to": "present",
                "location": "Remote",
                "responsibilities": "Build APIs",
            }
        ],
        "education": [
            {"institution": "University", "degree": "BSc", "year_start": 2018, "year_end": 2022}
        ],
        "projects": [
            {"title": "Library API", "description": "Built a tested API", "tech": ["Python"]}
        ],
    }
    calls = []

    def handle(request):
        body = json.loads(request.content)
        assert body["store"] is False
        assert (
            body["input"][0]["content"][1]["file_data"]
            == "data:application/pdf;base64," + base64.b64encode(pdf).decode()
        )
        assert "YYYY-MM" in body["instructions"]
        calls.append(body)
        return httpx.Response(200, json=completed(facts))

    app.state.profile_import.documents = Documents(config(), httpx.MockTransport(handle))
    response = client.post(
        "/user/profile/import", files={"file": ("resume.pdf", pdf, "application/pdf")}
    )
    assert response.status_code == 200, response.text
    assert len(calls) == 1
    assert response.json()["fields"]["experience"][0]["date_from"] == "2022-03"
    assert response.json()["fields"]["projects"][0]["title"] == "Library API"
    assert client.get("/user/profile").json() == before
    assert client.get("/resume").json() == []
    # Existing profile revision protection also applies after a long extraction.
    saved = client.post(
        "/user/profile/update",
        json={"profile": {**before["data"], **response.json()["fields"]}, "revision": 0},
    )
    assert saved.status_code == 200
    assert (
        client.post(
            "/user/profile/update", json={"profile": before["data"], "revision": 0}
        ).status_code
        == 409
    )


def test_profile_import_validation_and_provider_failure_do_not_change_data(client, app, settings):
    member(client)
    assert (
        client.post(
            "/user/profile/import", files={"file": ("file.txt", b"text", "text/plain")}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/user/profile/import", files={"file": ("file.pdf", b"not pdf", "application/pdf")}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/user/profile/import",
            files={
                "file": ("file.pdf", b"%PDF-" + b"x" * settings.max_upload_bytes, "application/pdf")
            },
        ).status_code
        == 413
    )
    assert (
        client.post(
            "/user/profile/import", files={"file": ("file.pdf", b"%PDF-broken", "application/pdf")}
        ).status_code
        == 422
    )
    pdf = Path("tests/fixtures/resume.pdf").read_bytes()
    app.state.profile_import.documents = Documents(
        config(), httpx.MockTransport(lambda request: httpx.Response(503))
    )
    assert (
        client.post(
            "/user/profile/import", files={"file": ("resume.pdf", pdf, "application/pdf")}
        ).status_code
        == 502
    )
    assert client.get("/user/profile").json()["revision"] == 0
    assert client.get("/resume").json() == []
