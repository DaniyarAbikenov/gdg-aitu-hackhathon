"""Structured logs with request ids, optional OpenTelemetry tracing and error reporting."""

import json
import logging
import re
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id: ContextVar[str] = ContextVar("request_id", default="")

SAFE_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")
STANDARD = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {"message", "asctime"}
access = logging.getLogger("career.access")


class JsonFormatter(logging.Formatter):
    """One JSON object per line; `extra=` fields are kept as top-level keys."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        entry |= {k: v for k, v in vars(record).items() if k not in STANDARD and v != ""}
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


_default_factory = logging.getLogRecordFactory()


def _stamped_record(*args: Any, **kwargs: Any) -> logging.LogRecord:
    """Records carry the request id from the moment they are created, not when written."""
    record = _default_factory(*args, **kwargs)
    record.request_id = request_id.get()
    return record


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    logging.setLogRecordFactory(_stamped_record)
    handler = logging.StreamHandler()
    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.set_name("career")
    root = logging.getLogger()
    # Replace only our own handler, so repeated setup and test log capture both keep working.
    root.handlers[:] = [h for h in root.handlers if h.get_name() != "career"] + [handler]
    root.setLevel(level)
    # Uvicorn's own handlers would print a second, unstructured copy.
    for name in ("uvicorn", "uvicorn.error", "rq.worker"):
        logging.getLogger(name).handlers[:] = []
        logging.getLogger(name).propagate = True
    # RequestContext writes the access line, with the request id and duration.
    logging.getLogger("uvicorn.access").disabled = True


class RequestContext:
    """Pure ASGI middleware: request id in and out, plus one access log line per request.

    A valid incoming `X-Request-ID` is kept so a proxy's id can be followed end to end.
    """

    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        incoming = headers.get(b"x-request-id", b"").decode("latin-1")
        current = incoming if SAFE_ID.fullmatch(incoming) else uuid.uuid4().hex
        token = request_id.set(current)
        started = time.perf_counter()
        status = 500

        async def send_with_id(message: dict[str, Any]) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [
                    *message.get("headers", []),
                    (b"x-request-id", current.encode()),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            # Logged here, while the request id is still set; the error handler only responds.
            logging.getLogger("career").exception("Unhandled error")
            raise
        finally:
            access.info(
                "%s %s %s",
                scope["method"],
                scope["path"],
                status,
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id.reset(token)


def init_sentry(dsn: str, environment: str, release: str) -> None:
    """Report unhandled errors. Request bodies and personal data are never sent."""
    if not dsn:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=release,
        send_default_pii=False,
        max_request_body_size="never",
        traces_sample_rate=0,
    )


def init_tracing(service: str, app: Any = None) -> None:
    """Export traces over OTLP/HTTP; endpoint and headers come from the standard OTEL_* env."""
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(resource=Resource.create({"service.name": service}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    HTTPXClientInstrumentor().instrument()
    RedisInstrumentor().instrument()
    if app is not None:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app, excluded_urls="health")


def trace_engine(engine: Any) -> None:
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

    SQLAlchemyInstrumentor().instrument(engine=engine)
