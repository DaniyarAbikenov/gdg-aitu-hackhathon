"""Request ids, structured logs and the generic error response."""

import json
import logging

from fastapi.testclient import TestClient
from rq.job import Job
from rq.serializers import JSONSerializer

from app.infrastructure.observability import JsonFormatter, request_id


def test_every_response_carries_a_request_id(client):
    generated = client.get("/health").headers["x-request-id"]
    assert len(generated) == 32
    kept = client.get("/health", headers={"X-Request-ID": "proxy-id-12345"})
    assert kept.headers["x-request-id"] == "proxy-id-12345"
    unsafe = client.get("/health", headers={"X-Request-ID": "bad id\nInjected: 1"})
    assert unsafe.headers["x-request-id"] != "bad id\nInjected: 1"


def test_access_log_is_structured(client, caplog):
    with caplog.at_level(logging.INFO, logger="career.access"):
        client.get("/health", headers={"X-Request-ID": "access-log-1"})
    record = next(r for r in caplog.records if r.name == "career.access")
    line = json.loads(JsonFormatter().format(record))
    assert line["method"] == "GET" and line["path"] == "/health" and line["status"] == 200
    assert line["duration_ms"] >= 0 and line["level"] == "INFO"


def test_records_carry_the_request_id_they_were_created_in(app):
    token = request_id.set("formatter-id-1")
    try:
        record = logging.getLogRecordFactory()(
            "career", logging.WARNING, "", 0, "Hi %s", ("you",), None
        )
    finally:
        request_id.reset(token)
    line = json.loads(JsonFormatter().format(record))
    assert line["message"] == "Hi you" and line["request_id"] == "formatter-id-1"


def test_unexpected_errors_are_logged_with_the_request_id(app, caplog):
    def broken():
        raise RuntimeError("boom")

    app.add_api_route("/broken", broken)
    with TestClient(app, raise_server_exceptions=False) as client:
        with caplog.at_level(logging.ERROR, logger="career"):
            response = client.get("/broken", headers={"X-Request-ID": "broken-request-1"})
    assert response.status_code == 500
    assert response.json() == {
        "detail": "Something went wrong. Please try again.",
        "code": "internal_error",
    }
    logged = next(r for r in caplog.records if r.getMessage() == "Unhandled error")
    assert json.loads(JsonFormatter().format(logged))["request_id"] == "broken-request-1"


def test_jobs_remember_the_request_that_queued_them(client, app, resume):
    response = client.post(
        f"/resume/{resume['resume_id']}/adapt",
        json={"revision": resume["revision"], "jd_text": "Python developer for public APIs"},
        headers={"Prefer": "respond-async", "X-Request-ID": "queued-by-request-1"},
    )
    connection = app.state.container.jobs.connection
    job = Job.fetch(response.json()["id"], connection=connection, serializer=JSONSerializer)
    assert job.meta["request_id"] == "queued-by-request-1"
