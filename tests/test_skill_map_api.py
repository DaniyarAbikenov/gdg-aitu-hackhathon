from tests.test_career import CONTEXT
from tests.test_linked_resumes import save_profile
from tests.test_product import member


def test_skill_map_combines_profile_vacancies_practice_and_plans(client):
    member(client)
    save_profile(client, skills=["Python", "Git"])
    for name, skills in [("Backend", ["Python", "Docker"]), ("Platform", ["Docker", "Go"])]:
        response = client.post(
            "/applications",
            json={
                "name": name,
                "company_name": "Atlas",
                "description": "Build reliable services for the platform team.",
                "skills": skills,
            },
        )
        assert response.status_code == 201

    interview = client.post("/interview/start", json=CONTEXT).json()
    for answer in ["problem contribution decision result", "assumptions", "test"]:
        interview = client.post(
            f"/interview/{interview['id']}/answer",
            json={"revision": interview["revision"], "answer": answer},
        ).json()
    assert interview["finished"]
    plan = client.post("/plan", json={"goal": "Containers", "stacks": ["Docker"]})
    assert plan.status_code in (200, 201), plan.text

    result = client.get("/skills/map")
    assert result.status_code == 200, result.text
    data = result.json()
    by_key = {n["key"]: n for n in data["nodes"]}
    assert data["vacancies"] == 2
    assert by_key["python"]["status"] == "strength"
    assert by_key["docker"]["status"] == "learning" and by_key["docker"]["demand"] == 2
    assert by_key["docker"]["learning"]["total"] == 8
    assert by_key["go"]["status"] == "gap"
    assert by_key["git"]["status"] == "have"
    assert by_key["postgresql"]["practice"][0]["interview_id"] == interview["id"]
    assert [s["score"] for s in data["scores"]] == [interview["score"]]
    assert {"source": "docker", "target": "go", "weight": 1} in data["links"]
    assert data["strongest"] == "python"
    assert data["next_to_learn"] == ["go"]


def test_empty_map_for_a_new_account(client):
    member(client)
    data = client.get("/skills/map").json()
    assert data == {
        "vacancies": 0,
        "nodes": [],
        "links": [],
        "scores": [],
        "strongest": None,
        "next_to_learn": [],
    }
