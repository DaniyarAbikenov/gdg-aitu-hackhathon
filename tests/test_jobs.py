"""Background AI jobs on real Redis: `Prefer: respond-async`, worker execution, SSE."""

import json
from uuid import uuid4

from fastapi.testclient import TestClient
from rq import SimpleWorker
from rq.serializers import JSONSerializer
from test_career import CONTEXT
from test_product import member

from app import worker

LATER = {"Prefer": "respond-async"}
JOB = "Python developer building and testing public APIs"


def work(app):
    """Run every queued job in this process, against the test app's use cases."""
    container = app.state.container
    worker.bind(container.use_cases)
    SimpleWorker(
        [container.jobs.queue], connection=container.jobs.connection, serializer=JSONSerializer
    ).work(burst=True)


def finished(client, app, response):
    assert response.status_code == 202
    job = response.json()
    assert response.headers["location"] == f"/api/jobs/{job['id']}"
    assert job["status"] == "queued" and job["result"] is None
    work(app)
    return client.get(f"/jobs/{job['id']}").json()


def test_adaptation_runs_in_the_worker_with_the_same_result(client, app, resume):
    revision = resume["revision"]
    body = {"revision": revision, "jd_text": JOB}
    job = finished(
        client, app, client.post(f"/resume/{resume['resume_id']}/adapt", json=body, headers=LATER)
    )
    assert job["status"] == "done" and job["operation"] == "resume.adapt"
    direct = client.post(f"/resume/{resume['resume_id']}/adapt", json=body).json()
    assert job["result"] == direct


def test_domain_errors_come_back_with_their_code(client, app, resume):
    body = {"revision": resume["revision"] + 5, "jd_text": JOB}
    job = finished(
        client, app, client.post(f"/resume/{resume['resume_id']}/adapt", json=body, headers=LATER)
    )
    assert job["status"] == "failed"
    assert job["error"]["code"] == "conflict"


def test_interview_plan_and_review_jobs(client, app, resume):
    started = finished(client, app, client.post("/interview/start", json=CONTEXT, headers=LATER))
    interview = started["result"]
    assert started["status"] == "done" and interview["question"]
    answered = finished(
        client,
        app,
        client.post(
            f"/interview/{interview['id']}/answer",
            json={"revision": interview["revision"], "answer": "I measured, tested and verified."},
            headers=LATER,
        ),
    )
    assert answered["result"]["answers"][0]["answer"] == "I measured, tested and verified."
    plan = finished(client, app, client.post("/plan", json={"goal": "Backend"}, headers=LATER))
    assert plan["status"] == "done" and plan["result"]["data"]["modules"]
    review = finished(
        client,
        app,
        client.post(
            f"/resume/{resume['resume_id']}/improve",
            json={"revision": resume["revision"], "jd_text": JOB},
            headers=LATER,
        ),
    )
    assert review["status"] == "done" and review["result"]["status"] == "reviewed"


def test_vacancy_import_reports_an_unconfigured_provider(client, app):
    member(client)
    job = finished(
        client,
        app,
        client.post("/applications/import", json={"text": "A real vacancy " * 10}, headers=LATER),
    )
    assert job["status"] == "failed" and job["error"]["code"] == "provider_unavailable"


def test_jobs_are_private_to_their_owner(client, app, resume):
    body = {"revision": resume["revision"], "jd_text": JOB}
    job = client.post(f"/resume/{resume['resume_id']}/adapt", json=body, headers=LATER).json()
    with TestClient(app) as other:
        other.post("/session")
        assert other.get(f"/jobs/{job['id']}").status_code == 404
        assert other.get(f"/jobs/{job['id']}/events").status_code == 404
    assert client.get(f"/jobs/{uuid4()}").json()["code"] == "not_found"


def test_events_stream_reports_the_final_status(client, app, resume):
    body = {"revision": resume["revision"], "jd_text": JOB}
    job = client.post(f"/resume/{resume['resume_id']}/adapt", json=body, headers=LATER).json()
    work(app)
    response = client.get(f"/jobs/{job['id']}/events")
    assert response.headers["content-type"].startswith("text/event-stream")
    events = [block for block in response.text.split("\n\n") if block]
    assert len(events) == 1
    name, data = events[0].split("\n")
    assert name == "event: status"
    assert json.loads(data.removeprefix("data: "))["status"] == "done"


def test_healthcheck_sees_only_a_registered_worker(client, app):
    container = app.state.container
    name = f"health-{uuid4().hex}"
    assert not worker.healthy(container.jobs.connection, name)
    running = SimpleWorker(
        [container.jobs.queue],
        name=name,
        connection=container.jobs.connection,
        serializer=JSONSerializer,
    )
    running.register_birth()
    try:
        assert worker.healthy(container.jobs.connection, name)
    finally:
        running.register_death()
    assert not worker.healthy(container.jobs.connection, name)
