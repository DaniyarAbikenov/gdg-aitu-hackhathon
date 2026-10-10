from tests.test_product import member

VACANCY = {
    "name": "Backend developer",
    "company_name": "Example Bank",
    "description": "We build services with Python and PostgreSQL.",
}


def save(client, vacancy_id=None, revision=0, **changes):
    body = {**VACANCY, **changes, "revision": revision}
    response = (
        client.put(f"/applications/{vacancy_id}", json=body)
        if vacancy_id
        else client.post("/applications", json=body)
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_funnel_and_rejection_review(client):
    member(client)
    first = save(client, status="applied")
    first = save(client, first["id"], first["revision"], status="interview")
    first = save(client, first["id"], first["revision"], status="rejected")
    save(client, status="applied")
    save(client)

    funnel = client.get("/applications/funnel", params={"offset": 300}).json()
    assert [(s["stage"], s["count"]) for s in funnel["stages"]] == [
        ("saved", 3),
        ("applied", 2),
        ("interview", 1),
        ("offer", 0),
    ]
    assert funnel["rejections"]["by_stage"][1] == {"stage": "interview", "count": 1}
    assert funnel["effort"][-1]["applications"] == 2
    assert {"key": "unreviewed", "params": {"count": 1}} in funnel["insights"]

    [item] = [a for a in client.get("/applications").json() if a["id"] == first["id"]]
    assert item["next_step_key"] == "reviewRejection"
    assert set(item["data"]["stages"]) == {"applied", "interview", "rejected"}

    stale = client.put(
        f"/applications/{first['id']}/rejection",
        json={"revision": 0, "reason": "technical"},
    )
    assert stale.status_code == 409
    reviewed = client.put(
        f"/applications/{first['id']}/rejection",
        json={
            "revision": first["revision"],
            "reason": "technical",
            "topics": ["SQL joins", " sql  JOINS ", "System design"],
            "feedback": "Strong Python, needs more SQL practice.",
        },
    )
    assert reviewed.status_code == 200, reviewed.text
    result = reviewed.json()
    assert result["rejection"]["stage"] == "interview"
    assert result["next_action"] == {
        "key": "studyTopics",
        "topics": ["SQL joins", "System design"],
    }
    [item] = [a for a in client.get("/applications").json() if a["id"] == first["id"]]
    assert item["rejection_action"]["key"] == "studyTopics"
    assert item["next_step_key"] == "wrapUp"
    insights = client.get("/applications/funnel").json()["insights"]
    assert {"key": "reviewed", "params": {"count": 1}} in insights

    # Editing the application later keeps both the survey and the stage dates.
    edited = save(
        client, first["id"], result["revision"], status="rejected", notes="Ask for feedback"
    )
    assert edited["data"]["rejection"]["reason"] == "technical"
    assert "interview" in edited["data"]["stages"]


def test_survey_needs_a_rejected_application(client):
    member(client)
    vacancy = save(client, status="applied")
    response = client.put(
        f"/applications/{vacancy['id']}/rejection",
        json={"revision": vacancy["revision"], "reason": "no_reply"},
    )
    assert response.status_code == 422
    assert (
        client.post("/applications", json={**VACANCY, "stages": {"offer": "x"}}).status_code == 422
    )
