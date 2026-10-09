"""Slow AI operations run in a worker; the browser follows their progress by job id."""

from datetime import datetime
from typing import Any, Literal, get_args

from app.application.ports import JobQueue, JobState
from app.domain.errors import NotFound
from app.domain.models import Session

Operation = Literal[
    "resume.analyze",
    "resume.adapt",
    "interview.start",
    "interview.answer",
    "plan.create",
    "vacancy.import",
    "letter.draft",
]
OPERATIONS: tuple[str, ...] = get_args(Operation)


def session_payload(session: Session) -> dict[str, Any]:
    return {
        "owner": session.owner,
        "expires_at": session.expires_at.isoformat(),
        "persistent": session.persistent,
        "auth_version": session.auth_version,
    }


def session_from(payload: dict[str, Any]) -> Session:
    return Session(
        owner=payload["owner"],
        expires_at=datetime.fromisoformat(payload["expires_at"]),
        persistent=payload["persistent"],
        auth_version=payload["auth_version"],
    )


class Jobs:
    def __init__(self, queue: JobQueue):
        self.queue = queue

    def submit(self, session: Session, operation: Operation, **arguments: Any) -> JobState:
        payload = {"session": session_payload(session), "arguments": arguments}
        return self.get(session, self.queue.submit(session.owner, operation, payload))

    def get(self, session: Session, job_id: str) -> JobState:
        job = self.queue.get(job_id)
        # Another owner's job is indistinguishable from a missing one.
        if job is None or job.owner != session.owner:
            raise NotFound("Job not found.")
        return job
