"""Background worker: runs slow AI use cases queued by the API.

python -m app.worker          run jobs
python -m app.worker --check  exit 0 if this container's worker is registered (healthcheck)
"""

import dataclasses
import logging
import socket
import sys
from collections.abc import Callable
from typing import Any

from rq import SimpleWorker, get_current_job
from rq.serializers import JSONSerializer

from app.application.jobs import session_from
from app.config import Settings
from app.domain.errors import DomainError
from app.domain.models import Session
from app.infrastructure.jobs import RedisJobQueue
from app.infrastructure.observability import request_id, trace_engine
from app.presentation.dependencies import UseCases

Handler = Callable[[UseCases, Session, dict[str, Any]], Any]

OPERATIONS: dict[str, Handler] = {
    "resume.analyze": lambda cases, session, a: cases.resumes.analyze(session, **a),
    "resume.adapt": lambda cases, session, a: cases.adaptation.adapt(session, **a),
    "interview.start": lambda cases, session, a: cases.interviews.start(session, **a),
    "interview.answer": lambda cases, session, a: cases.interviews.answer(session, **a),
    "plan.create": lambda cases, session, a: cases.learning.create(session, **a),
    "vacancy.import": lambda cases, session, a: cases.applications.import_draft(session, **a),
    "letter.draft": lambda cases, session, a: cases.applications.cover_letter(session, **a),
}

log = logging.getLogger("career.worker")
_use_cases: UseCases | None = None


def bind(use_cases: UseCases) -> None:
    """Use the given use cases for jobs run in this process (the worker or a test)."""
    global _use_cases
    _use_cases = use_cases


def plain(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    if isinstance(value, list):
        return [plain(item) for item in value]
    return value


def run(operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Job entry point. Domain errors become a coded result the browser can translate."""
    if _use_cases is None:
        raise RuntimeError("Worker use cases are not bound")
    session = session_from(payload["session"])
    job = get_current_job()
    token = request_id.set(job.meta.get("request_id", "") if job else "")
    try:
        result = OPERATIONS[operation](_use_cases, session, payload["arguments"])
    except DomainError as error:
        log.info("Job %s ended with %s", operation, error.code, extra={"code": error.code})
        return {"error": {"code": error.code, "detail": error.message}}
    finally:
        request_id.reset(token)
    return {"result": plain(result)}


def healthy(connection: Any, name: str) -> bool:
    """A worker refreshes its Redis key on every heartbeat; a hung one expires, a stopped one
    is marked dead."""
    key = SimpleWorker.redis_worker_namespace_prefix + name
    return bool(connection.exists(key)) and not connection.hexists(key, "death")


def main() -> None:
    from app.main import build_container, configure_observability

    settings = Settings()
    if "--check" in sys.argv[1:]:
        connection = RedisJobQueue(settings.redis_url, settings.redis_namespace).connection
        sys.exit(0 if healthy(connection, socket.gethostname()) else 1)
    configure_observability(settings, "career-worker")
    container = build_container(settings)
    if settings.otel_enabled:
        trace_engine(container.repository.engine)
    # Under `python -m` this file is __main__; RQ imports jobs from app.worker, so bind that module.
    from app import worker

    worker.bind(container.use_cases)
    try:
        SimpleWorker(
            [container.jobs.queue],
            name=socket.gethostname(),
            connection=container.jobs.connection,
            serializer=JSONSerializer,
        ).work(with_scheduler=False)
    finally:
        container.close()


if __name__ == "__main__":
    main()
