"""Redis-backed job queue (RQ). Job payloads and results are JSON, never pickles."""

from dataclasses import asdict
from typing import Any

from redis import Redis
from rq import Queue, Retry
from rq.exceptions import NoSuchJobError
from rq.job import Job
from rq.serializers import JSONSerializer

from app.application.ports import EmailMessage, JobState, JobStatus
from app.infrastructure.observability import request_id

RUN = "app.worker.run"
DELIVER = "app.worker.deliver"
# Statuses RQ reports for jobs that never produced a result.
FAILED = {"failed", "stopped", "canceled"}
FAILURE = {
    "code": "provider_unavailable",
    "detail": "AI processing is temporarily unavailable. Please retry later.",
}


class RedisJobQueue:
    def __init__(self, redis_url: str, namespace: str, timeout: int = 180):
        # RQ stores binary payloads, so it needs its own connection without response decoding.
        self.connection = Redis.from_url(redis_url, socket_timeout=5, socket_connect_timeout=3)
        self.queue = Queue(
            f"{namespace}-ai",
            connection=self.connection,
            serializer=JSONSerializer,
            default_timeout=timeout,
        )

        # Emails get their own queue, which the worker drains before AI jobs.
        self.mail = Queue(
            f"{namespace}-mail",
            connection=self.connection,
            serializer=JSONSerializer,
            default_timeout=30,
        )

    @property
    def queues(self) -> list[Queue]:
        return [self.mail, self.queue]

    def submit(self, owner: str, operation: str, payload: dict[str, Any]) -> str:
        job = self.queue.enqueue(
            RUN,
            operation,
            payload,
            # The request id lets the worker's log lines be matched to the API request.
            meta={"owner": owner, "operation": operation, "request_id": request_id.get()},
            # Unstarted jobs expire, so a stopped worker never leaves stale work behind.
            ttl=600,
            result_ttl=3600,
            failure_ttl=3600,
        )
        return job.id

    def get(self, job_id: str) -> JobState | None:
        try:
            job = Job.fetch(job_id, connection=self.connection, serializer=JSONSerializer)
        except NoSuchJobError:
            return None
        status = job.get_status(refresh=False)
        owner, operation = job.meta.get("owner", ""), job.meta.get("operation", "")
        if status == "finished":
            outcome = job.return_value() or {}
            if "error" in outcome:
                return JobState(job.id, owner, operation, "failed", error=outcome["error"])
            return JobState(job.id, owner, operation, "done", result=outcome.get("result"))
        if status in FAILED:
            return JobState(job.id, owner, operation, "failed", error=FAILURE)
        state: JobStatus = "running" if status == "started" else "queued"
        return JobState(job.id, owner, operation, state)

    def close(self) -> None:
        self.connection.close()


class QueuedMailer:
    """Sends email from the worker, so SMTP latency never shows in a request's timing."""

    def __init__(self, jobs: RedisJobQueue):
        self.queue = jobs.mail

    def send(self, message: EmailMessage) -> None:
        self.queue.enqueue(
            DELIVER,
            asdict(message),
            meta={"request_id": request_id.get()},
            retry=Retry(max=2),
            ttl=3600,
            result_ttl=0,
            failure_ttl=24 * 3600,
        )
