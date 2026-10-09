"""Job status for operations started with `Prefer: respond-async`."""

import asyncio
import json
import time
from collections.abc import AsyncIterator
from dataclasses import asdict
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from app.application.ports import JobState
from app.presentation.dependencies import Cases, Workspace
from app.presentation.responses import JobView

POLL_SECONDS = 0.5
KEEPALIVE_SECONDS = 10
STREAM_SECONDS = 600
ENDED = {"done", "failed"}
# Documents the 202 alternative on endpoints that accept `Prefer: respond-async`.
ACCEPTED: dict[int | str, dict[str, Any]] = {
    202: {"model": JobView, "description": "Accepted as a background job"}
}


def job_view(job: JobState) -> dict[str, Any]:
    view = asdict(job)
    del view["owner"]
    return view


def accepted(job: JobState) -> JSONResponse:
    return JSONResponse(job_view(job), status_code=202, headers={"Location": f"/api/jobs/{job.id}"})


def event(name: str, data: dict[str, Any]) -> str:
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def jobs_router() -> APIRouter:
    routes = APIRouter()

    @routes.get("/jobs/{job_id}", response_model=JobView)
    def job(job_id: UUID, cases: Cases, current: Workspace):
        return job_view(cases.jobs.get(current, str(job_id)))

    @routes.get("/jobs/{job_id}/events")
    def events(job_id: UUID, cases: Cases, current: Workspace):
        """Server-sent events: one `status` event per change, ending with done or failed."""
        first = cases.jobs.get(current, str(job_id))

        async def stream() -> AsyncIterator[str]:
            job, last = first, ""
            started = quiet = time.monotonic()
            while True:
                if job.status != last:
                    yield event("status", job_view(job))
                    last, quiet = job.status, time.monotonic()
                if job.status in ENDED or time.monotonic() - started > STREAM_SECONDS:
                    return
                if time.monotonic() - quiet > KEEPALIVE_SECONDS:
                    yield ": keep-alive\n\n"
                    quiet = time.monotonic()
                await asyncio.sleep(POLL_SECONDS)
                job = await asyncio.to_thread(cases.jobs.get, current, str(job_id))

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    return routes
