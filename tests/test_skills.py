from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from app.domain.skills import skill_key
from app.infrastructure.skills import PostgresSkillRepository


def signin(client):
    assert (
        client.post(
            "/auth/register",
            json={"email": f"{uuid4()}@example.com", "password": "long test password"},
        ).status_code
        == 201
    )


def test_normalization_preserves_distinct_technologies():
    assert skill_key("  ＣＳＳ  ") == skill_key("css") == "css"
    assert skill_key("  Machine   Learning ") == "machine learning"
    assert len({skill_key(x) for x in ["C", "C++", "C#", ".NET"]}) == 4


def test_catalog_shared_search_description_and_duplicates(client, app):
    assert client.get("/skills").status_code == 401
    signin(client)
    css = client.get("/skills", params={"q": "css"}).json()["skills"][0]
    assert css["name"] == "CSS"
    duplicate = client.post(
        "/skills", json={"name": "  css ", "description": "Attempted replacement description"}
    ).json()
    assert duplicate == css
    name = "Custom skill " + str(uuid4())[:8]
    new = client.post(
        "/skills", json={"name": name, "description": "Description contributed by another user."}
    ).json()
    assert new["name"] == name
    client.post("/auth/logout")
    client.post("/session")
    signin(client)
    found = client.get("/skills", params={"q": name}).json()["skills"][0]
    assert found == new
    assert any(
        item["name"] == "JavaScript"
        for item in client.get("/skills", params={"q": "Javascrip"}).json()["skills"]
    )
    assert (
        client.post("/skills", json={"name": " ", "description": "Valid description"}).status_code
        == 422
    )
    assert client.post("/skills", json={"name": "New", "description": "short"}).status_code == 422
    assert len(client.get("/skills", params={"q": "%"}).json()["skills"]) == 0


def test_concurrent_additions_share_identity(app, client):
    repository = PostgresSkillRepository(app.state.repository.engine)
    name = "Concurrent " + str(uuid4())

    def create(index):
        return repository.add(
            name.upper() if index else name, skill_key(name), "Original description"
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(create, range(4)))
    assert len({row["id"] for row in results}) == 1
