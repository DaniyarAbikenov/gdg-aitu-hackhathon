from tests.test_product import member


def save_profile(client, **changes):
    current = client.get("/user/profile").json()
    profile = {**current["data"], **changes}
    response = client.post(
        "/user/profile/update", json={"profile": profile, "revision": current["revision"]}
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_resume_follows_the_master_profile_and_keeps_history(client):
    member(client)
    profile = save_profile(
        client,
        full_name="Aru Example",
        summary="Backend developer",
        skills=["Python", "SQL"],
        interests=["Chess", "Mountain hiking"],
        awards=[{"title": "University hackathon, 1st place", "detail": "", "year": 2024}],
        experience=[
            {"company": "Library", "role": "Engineer", "responsibilities": "Build APIs"},
            {"company": "Cafe", "role": "Barista", "responsibilities": "Coffee"},
        ],
    )
    job_ids = [e["id"] for e in profile["experience"]]
    assert all(job_ids) and len(set(job_ids)) == 2
    assert profile["awards"][0]["id"]

    created = client.post(
        "/resume/create",
        json={
            "title": "Backend",
            "position": "Backend developer",
            "sections": ["summary", "experience", "skills", "awards"],
            "selection": {"experience": [job_ids[0]]},
        },
    )
    assert created.status_code == 201, created.text
    resume = created.json()["resume"]
    assert "profile_link" not in resume
    assert [e["company"] for e in resume["fields"]["experience"]] == ["Library"]
    assert resume["fields"]["awards"][0]["title"].startswith("University")
    assert (
        "interests" not in created.json()["resume"]["fields"] or not resume["fields"]["interests"]
    )
    resume_id = resume["resume_id"]
    assert client.get("/resume-links").json() == {resume_id: "current"}

    # The candidate learns Docker and is promoted; the resume is not changed silently.
    profile = save_profile(
        client,
        skills=["Python", "SQL", "Docker"],
        experience=[
            {**profile["experience"][0], "role": "Senior Engineer"},
            profile["experience"][1],
        ],
    )
    client.post(
        "/applications",
        json={
            "name": "Backend developer",
            "company_name": "Example Bank",
            "description": "We build services with Python and Docker.",
        },
    )
    assert (
        client.get(f"/resume/{resume_id}").json()["fields"]["experience"][0]["role"] == "Engineer"
    )
    assert client.get("/resume-links").json() == {resume_id: "outdated"}
    changes = client.get(f"/resume/{resume_id}/profile-changes").json()
    by_kind = {c["kind"]: c for c in changes["changes"]}
    assert by_kind["update"]["profile"]["role"] == "Senior Engineer"
    assert by_kind["new"]["key"] == "docker" and by_kind["new"]["demand"] == 1
    assert all(c["key"] != job_ids[1] for c in changes["changes"])

    applied = client.post(
        f"/resume/{resume_id}/profile-changes",
        json={
            "revision": changes["revision"],
            "accept": [by_kind["update"]["id"], by_kind["new"]["id"]],
            "label": "Before the profile update",
        },
    )
    assert applied.status_code == 200, applied.text
    fields = applied.json()["fields"]
    assert fields["experience"][0]["role"] == "Senior Engineer"
    assert fields["skills"] == ["Python", "SQL", "Docker"]
    assert client.get("/resume-links").json() == {resume_id: "current"}

    [version] = client.get(f"/resume/{resume_id}/versions").json()
    assert version["data"]["label"] == "Before the profile update"
    assert version["data"]["fields"]["experience"][0]["role"] == "Engineer"

    # A stale list of changes is refused instead of applied to newer data.
    stale = client.post(
        f"/resume/{resume_id}/profile-changes",
        json={
            "revision": applied.json()["revision"],
            "accept": [by_kind["update"]["id"]],
            "label": "x",
        },
    )
    assert stale.status_code == 409


def test_edits_on_both_sides_wait_for_review(client):
    member(client)
    profile = save_profile(
        client,
        summary="Backend developer",
        experience=[{"company": "Library", "role": "Engineer", "responsibilities": "Build APIs"}],
    )
    resume = client.post(
        "/resume/create",
        json={"title": "Backend", "position": "Dev", "sections": ["summary", "experience"]},
    ).json()["resume"]
    fields = {**resume["fields"], "summary": "Backend developer for search teams"}
    fields["experience"][0]["responsibilities"] = "Build search APIs"
    saved = client.post(
        f"/resume/{resume['resume_id']}/save",
        json={"fields": fields, "revision": resume["revision"]},
    ).json()
    assert saved["fields"]["experience"][0]["id"] == profile["experience"][0]["id"]
    assert client.get(f"/resume/{resume['resume_id']}/profile-changes").json()["changes"] == []

    save_profile(
        client,
        experience=[{**profile["experience"][0], "responsibilities": "Build APIs and reports"}],
    )
    changes = client.get(f"/resume/{resume['resume_id']}/profile-changes").json()
    assert changes["status"] == "review"
    [review] = changes["changes"]
    assert review["resume"]["responsibilities"] == "Build search APIs"
    kept = client.post(
        f"/resume/{resume['resume_id']}/profile-changes",
        json={"revision": saved["revision"], "dismiss": [review["id"]], "label": "unused"},
    )
    assert kept.status_code == 200
    assert kept.json()["fields"]["experience"][0]["responsibilities"] == "Build search APIs"
    # Keeping the resume text is not an edit, so no version is stored.
    assert client.get(f"/resume/{resume['resume_id']}/versions").json() == []
    assert client.get("/resume-links").json()[resume["resume_id"]] == "current"
