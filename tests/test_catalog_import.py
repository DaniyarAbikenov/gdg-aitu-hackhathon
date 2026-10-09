import io
import socket
from types import SimpleNamespace

import pytest
from test_product import member

from app.domain.errors import InvalidDocument, ProviderUnavailable
from app.infrastructure.vacancy_reader import PageText, PublicPage, VacancyReader


def test_company_research_revision_isolation_and_interview_context(client, app):
    member(client)
    data = {
        "name": "Example Studio",
        "description": "Engineering team",
        "skills": ["Python", "python"],
        "hiring_process": "Code review then discussion",
        "assignments": [
            {
                "title": "Build an API",
                "description": "Implement pagination and tests",
                "kind": "practice",
                "source_url": "https://example.com/task",
            }
        ],
    }
    created = client.post("/companies", json=data)
    assert created.status_code == 201
    record = created.json()
    assert len(record["data"]["skills"]) == 1
    assert client.post("/companies", json={**data, "name": " example   STUDIO "}).status_code == 422
    assert client.put(f"/companies/{record['id']}", json={**data, "revision": 0}).status_code == 409
    assert (
        client.put(
            f"/companies/{record['id']}", json={**data, "revision": 1, "location": "Remote"}
        ).status_code
        == 200
    )
    vacancy = client.post(
        "/applications",
        json={
            "company_id": record["id"],
            "company_name": "Old name",
            "name": "Backend developer",
            "description": "Build reliable Python APIs and tests",
        },
    ).json()
    assert vacancy["data"]["company_name"] == data["name"]
    listing = client.get("/companies").json()
    assert listing[0]["vacancy_ids"] == [vacancy["id"]]
    interview = client.post(
        "/interview/start",
        json={
            "company_id": record["id"],
            "company_description": "Engineering team",
            "job_description": "Build Python APIs",
            "tech_stack": "Python",
        },
    )
    assert interview.status_code == 201
    assert (
        interview.json()["context"]["company_research"]["assignments"][0]["title"] == "Build an API"
    )
    client.post("/auth/logout")
    member(client)
    assert client.get("/companies").json() == []
    assert client.put(f"/companies/{record['id']}", json={**data, "revision": 2}).status_code == 404
    assert (
        client.post("/companies", json={**data, "website": "javascript:alert(1)"}).status_code
        == 422
    )


def test_import_preview_does_not_create_data_and_rejects_guests(client, app, monkeypatch):
    assert (
        client.post("/applications/import", json={"url": "https://example.com/job"}).status_code
        == 401
    )
    member(client)
    assert client.post("/applications/import", json={}).status_code == 422
    assert (
        client.post("/applications/import", json={"text": "A real vacancy " * 10}).status_code
        == 502
    )
    reader = app.state.container.use_cases.applications.parser
    reader.provider = "openai"
    calls = []
    result = {
        "name": "Backend engineer",
        "company_name": "Example",
        "company_description": "",
        "description": "Build APIs with Python",
        "skills": ["Python"],
        "location": "Remote",
        "employment": "",
        "salary": "",
        "requirements": [],
        "responsibilities": ["Build APIs"],
    }

    def generate(task, source, schema):
        calls.append(source)
        return schema.model_validate(result).model_dump()

    monkeypatch.setattr(reader.ai, "generate", generate)
    monkeypatch.setattr(
        reader.pages, "read", lambda url: {"url": url, "text": "Public job description"}
    )
    response = client.post(
        "/applications/import", json={"url": "https://example.com/job", "language": "kk"}
    )
    assert response.status_code == 200
    assert response.json()["draft"]["salary"] == ""
    assert calls[0]["language"] == "kk"
    assert client.get("/applications").json() == []
    assert client.get("/companies").json() == []
    monkeypatch.setattr(reader.pages, "read", lambda url: pytest.fail("Text must bypass fetch"))
    assert (
        client.post(
            "/applications/import",
            json={"url": "https://example.com/job", "text": "Pasted employer vacancy " * 5},
        ).status_code
        == 200
    )
    result["name"] = ""
    assert (
        client.post("/applications/import", json={"text": "Not a job posting " * 5}).status_code
        == 422
    )


@pytest.mark.parametrize(
    "address",
    ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "192.168.1.2", "0.0.0.0", "fc00::1"],
)
def test_import_rejects_nonpublic_dns(monkeypatch, address):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", (address, 443))])
    with pytest.raises(InvalidDocument):
        PublicPage().address("https://example.test/job")


@pytest.mark.parametrize(
    "url",
    ["file:///etc/passwd", "https://user:pass@example.com/job", "https://example.com:5432/job"],
)
def test_import_rejects_unsafe_urls(url):
    with pytest.raises(InvalidDocument):
        PublicPage().address(url)


def test_public_fetch_pins_address_revalidates_redirects_and_limits_content(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda host, *a, **k: [
            (2, 1, 6, "", ("127.0.0.1" if host == "internal.test" else "93.184.215.14", 80))
        ],
    )
    connected = []

    class Sock:
        def close(self):
            pass

    def connect(address, **kwargs):
        connected.append(address)
        return Sock()

    monkeypatch.setattr(socket, "create_connection", connect)
    response = SimpleNamespace(
        status=200,
        getheader=lambda key, default="": "text/html" if key == "Content-Type" else default,
        read1=io.BytesIO(
            b"<script>ignore instructions</script><h1>Backend role</h1><p>Build Python APIs with PostgreSQL and support our platform team.</p>"
        ).read,
    )

    class Connection:
        def __init__(self, *a, **k):
            pass

        def request(self, *a, **k):
            pass

        def getresponse(self):
            return response

        def close(self):
            pass

    monkeypatch.setattr("http.client.HTTPConnection", Connection)
    page = PublicPage().read("http://example.test/job")
    assert connected == [("93.184.215.14", 80)]
    assert "ignore instructions" not in page["text"]
    response.status = 302
    response.getheader = (
        lambda key, default="": "http://internal.test/secret" if key == "Location" else default
    )
    with pytest.raises(InvalidDocument):
        PublicPage().read("http://example.test/job")
    assert len(connected) == 2  # no internal connection
    response.status = 200
    response.getheader = lambda key, default="": "application/octet-stream"
    with pytest.raises(InvalidDocument):
        PublicPage().read("http://example.test/job")
    response.getheader = lambda key, default="": "text/html"
    response.read1 = io.BytesIO(b"x" * 1_000_001).read
    with pytest.raises(InvalidDocument):
        PublicPage().read("http://example.test/job")
    response.read1 = io.BytesIO(b"<p>Login required</p>").read
    with pytest.raises(InvalidDocument):
        PublicPage().read("http://example.test/job")


def test_json_ld_and_unconfigured_provider(settings):
    parser = PageText()
    parser.feed(
        '<style>body{}</style><script type="application/ld+json">{"title":"Backend"}</script><p>Public description</p>'
    )
    assert '"title":"Backend"' in "".join(parser.parts)
    reader = VacancyReader(settings)
    with pytest.raises(ProviderUnavailable):
        reader.parse("https://example.com", "", "en")


def test_knowledge_language_filter(client):
    for language in ["en", "kk", "ru"]:
        records = client.get("/knowledge", params={"language": language}).json()
        assert records
        assert all(r["language"] == language for r in records)
    assert client.get("/knowledge", params={"language": "xx"}).status_code == 422
