"""Cover letters from confirmed facts and iCalendar exports."""

from datetime import date

from test_jobs import LATER, finished
from test_product import member
from test_release import application

from app.application.calendar import CalendarEvent, calendar, fold

PROFILE = {
    "full_name": "Alex Doe",
    "summary": "Backend developer who builds tested public APIs.",
    "skills": ["Python", "PostgreSQL"],
    "experience": [
        {
            "company": "City Library",
            "role": "Backend intern",
            "date_from": "2025-01",
            "date_to": "2025-06",
        }
    ],
}


def fill_profile(client):
    profile = client.get("/user/profile").json()
    saved = client.post(
        "/user/profile/update", json={"profile": profile["data"] | PROFILE, "revision": 0}
    )
    assert saved.status_code == 200, saved.text


def test_letter_needs_confirmed_facts(client):
    member(client)
    item = application(client)
    response = client.post(f"/applications/{item['id']}/cover-letter", json={"language": "en"})
    assert response.status_code == 422
    assert response.json()["code"] == "letter_needs_facts"


def test_letter_uses_only_profile_facts_and_names_gaps(client):
    member(client)
    fill_profile(client)
    item = application(client, skills=["Python", "PostgreSQL", "Docker"])
    draft = client.post(f"/applications/{item['id']}/cover-letter", json={"language": "en"}).json()
    assert draft["provider"] == "local"
    assert draft["matched_skills"] == ["Python", "PostgreSQL"]
    assert draft["missing_skills"] == ["Docker"]
    assert "Dear Library team team," in draft["text"]
    assert "Backend intern at City Library" in draft["text"]
    assert "I have not yet worked with Docker" in draft["text"]
    assert draft["text"].endswith("Alex Doe")
    assert set(draft["facts_used"]) <= {
        PROFILE["summary"],
        "Python",
        "PostgreSQL",
        "Backend intern, City Library",
    }
    for language, phrase in [("ru", "Откликаюсь"), ("kk", "өтінім")]:
        text = client.post(
            f"/applications/{item['id']}/cover-letter", json={"language": language}
        ).json()["text"]
        assert phrase in text


def test_accepted_letter_is_kept_by_later_edits(client):
    member(client)
    item = application(client)
    data = {
        k: v
        for k, v in item["data"].items()
        if k not in {"updated_at", "company_id", "stages", "rejection"}
    }
    saved = client.put(
        f"/applications/{item['id']}",
        json={**data, "revision": item["revision"], "cover_letter": "My accepted letter"},
    ).json()
    edited = client.put(
        f"/applications/{item['id']}",
        json={**data, "revision": saved["revision"], "notes": "Called on Monday"},
    )
    assert edited.status_code == 200
    assert client.get("/applications").json()[0]["data"]["cover_letter"] == "My accepted letter"


def test_letter_draft_as_a_background_job(client, app):
    member(client)
    fill_profile(client)
    item = application(client)
    job = finished(
        client,
        app,
        client.post(
            f"/applications/{item['id']}/cover-letter", json={"language": "en"}, headers=LATER
        ),
    )
    assert job["status"] == "done" and job["result"]["text"].startswith("Dear")


def test_follow_ups_calendar(client):
    member(client)
    application(client, follow_up="2026-11-02", next_action="Call the recruiter, ask about tests")
    application(client, name="Closed role", follow_up="2026-11-03", status="rejected")
    response = client.get("/applications/calendar.ics")
    assert response.headers["content-type"].startswith("text/calendar")
    body = response.text
    assert body.startswith("BEGIN:VCALENDAR\r\n") and body.endswith("END:VCALENDAR\r\n")
    assert body.count("BEGIN:VEVENT") == 1
    assert "DTSTART;VALUE=DATE:20261102" in body
    assert "DESCRIPTION:Call the recruiter\\, ask about tests" in body


def test_plan_calendar_has_one_reminder_per_week(client):
    plan = client.post("/plan", json={"goal": "Backend engineering"}).json()
    body = client.get(f"/plan/{plan['id']}/calendar.ics", params={"start": "2026-11-02"}).text
    assert body.count("BEGIN:VEVENT") == 8
    assert "DTSTART;VALUE=DATE:20261102" in body and "DTSTART;VALUE=DATE:20261221" in body


def test_long_lines_are_folded_without_splitting_characters():
    lines = fold("SUMMARY:" + "ж" * 80)
    assert all(len(line.encode()) <= 75 for line in lines)
    assert "".join(line.removeprefix(" ") for line in lines) == "SUMMARY:" + "ж" * 80
    event = CalendarEvent("u1", date(2026, 1, 1), "Plan; review", "a\\b")
    text = calendar("Name", [event])
    assert "SUMMARY:Plan\; review" in text and "DESCRIPTION:a\\\\b" in text
