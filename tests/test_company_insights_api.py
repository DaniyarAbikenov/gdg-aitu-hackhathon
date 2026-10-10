"""Company research and moderated interview reports through the API."""

from tests.test_company_insights import HOME, PAGES, REPORT
from tests.test_product import allow_admins, member


class Site:
    def read(self, website):
        assert website.rstrip("/") == HOME
        return PAGES


def switch(client, email=None):
    client.post("/auth/logout")
    return member(client, email)


def company(client, **changes):
    body = {"name": "Example Pay", "website": HOME, **changes}
    response = client.post("/companies", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_research_keeps_quoted_facts_and_survives_edits(client):
    member(client)
    client.app.state.container.use_cases.company_insights.site = Site()
    created = company(client)

    stale = client.post(f"/companies/{created['id']}/research", json={"revision": 9})
    assert stale.status_code == 409
    response = client.post(
        f"/companies/{created['id']}/research", json={"revision": created["revision"]}
    )
    assert response.status_code == 200, response.text
    research = response.json()["research"]
    assert research["provider"] == "rule-based"
    assert research["sources"] == [HOME, f"{HOME}/careers"]
    assert research["dropped"] == 0
    assert {f["source_url"] for f in research["facts"]} == {HOME, f"{HOME}/careers"}
    assert [s["name"] for s in research["stack"]] == ["Python", "PostgreSQL", "Kubernetes"]

    saved = response.json()
    edited = client.put(
        f"/companies/{saved['id']}",
        json={
            "name": "Example Pay",
            "website": HOME,
            "notes": "Call",
            "revision": saved["revision"],
        },
    ).json()
    assert edited["data"]["research"] == research
    moved = client.put(
        f"/companies/{saved['id']}",
        json={
            "name": "Example Pay",
            "website": "https://new.test/",
            "revision": edited["revision"],
        },
    ).json()
    assert "research" not in moved["data"]

    no_site = company(client, name="Offline Inc", website=None)
    missing = client.post(f"/companies/{no_site['id']}/research", json={"revision": 1})
    assert missing.status_code == 422
    assert missing.json()["code"] == "company_no_website"


def test_reports_are_moderated_anonymous_and_deletable(client):
    admin = "moderator@example.com"
    member(client)
    guest_company = company(client)
    # The author shares a report and sees it at once, marked as waiting.
    shared = client.post(f"/companies/{guest_company['id']}/reports", json=REPORT)
    assert shared.status_code == 201, shared.text
    report = shared.json()
    assert report["status"] == "pending" and report["mine"] is True
    assert "owner" not in report
    private = client.post(
        f"/companies/{guest_company['id']}/reports",
        json={**REPORT, "advice": "Write to anna@example.com"},
    )
    assert private.json()["code"] == "report_private"
    assert (
        client.post(
            f"/companies/{guest_company['id']}/reports", json={**REPORT, "difficulty": 9}
        ).status_code
        == 422
    )

    # Another candidate tracking the same company does not see it before moderation.
    switch(client)
    other = company(client, name="  example   PAY ")
    assert client.get(f"/companies/{other['id']}/reports").json() == []
    assert client.get("/admin/reports").status_code == 403

    switch(client, admin)
    allow_admins(client, admin)
    [queued] = client.get("/admin/reports").json()
    assert queued["id"] == report["id"] and "owner" not in queued and queued["mine"] is False
    approved = client.post(
        f"/admin/reports/{report['id']}", json={"status": "approved", "note": "Thanks"}
    )
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    assert client.get("/admin/reports").json() == []

    switch(client)
    seen = company(client, name="Example pay")
    [visible] = client.get(f"/companies/{seen['id']}/reports").json()
    assert visible["mine"] is False and visible["moderation_note"] is None
    assert visible["questions"] == REPORT["questions"]
    assert client.delete(f"/reports/{report['id']}").status_code == 404


def test_reports_have_a_daily_limit_and_are_exported(client):
    member(client)
    mine = company(client)
    for _ in range(5):
        assert client.post(f"/companies/{mine['id']}/reports", json=REPORT).status_code == 201
    limited = client.post(f"/companies/{mine['id']}/reports", json=REPORT)
    assert limited.status_code == 429 and limited.json()["code"] == "report_quota"

    [first, *_] = client.get("/reports").json()
    assert client.delete(f"/reports/{first['id']}").status_code == 204
    assert len(client.get("/reports").json()) == 4
    exported = client.get("/account/export")
    assert exported.status_code == 200, exported.text
    assert len(exported.json()["interview_reports"]) == 4
