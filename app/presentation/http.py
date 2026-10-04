import logging
from urllib.parse import urlsplit

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError

from app.domain.errors import (
    Conflict,
    InvalidDocument,
    NotFound,
    ProviderUnavailable,
    QuotaExceeded,
)


class RequestSizeLimit:
    """Bound transient request buffering even when Content-Length is absent."""

    def __init__(self, app, limit):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.limit:
                response = JSONResponse(status_code=413, content={"detail": "Upload is too large."})
                return await response(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def configure_http(app, settings):
    app.add_middleware(RequestSizeLimit, limit=settings.max_upload_bytes + 65536)

    @app.middleware("http")
    async def browser_headers(request, call_next):
        origin = request.headers.get("origin")
        if origin and request.method not in {"GET", "HEAD", "OPTIONS"}:
            if urlsplit(origin).netloc != request.headers.get("host"):
                return JSONResponse(
                    status_code=403, content={"detail": "Cross-origin request denied."}
                )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        if request.url.path == "/" or request.url.path.startswith("/static/"):
            google = " https://accounts.google.com" if settings.google_client_id else ""
            response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
            response.headers["Content-Security-Policy"] = (
                f"default-src 'self'; script-src 'self'{google}; style-src 'self'{google}; "
                f"font-src 'self'; img-src 'self' data:; connect-src 'self'{google}; frame-src 'self'{google}; "
                "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
            )
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Check the form values.",
                "errors": [
                    {"field": ".".join(map(str, e["loc"])), "message": e["msg"]}
                    for e in exc.errors()
                ],
            },
        )

    errors = {
        NotFound: (404, "Resume not found."),
        Conflict: (409, "This resume changed in another tab. Reload it before continuing."),
        QuotaExceeded: (
            429,
            "Workspace limit reached. Delete old resumes or try analysis again in an hour.",
        ),
        ProviderUnavailable: (
            502,
            "The AI reviewer is unavailable. Your resume is saved. Please try again.",
        ),
    }

    async def known_error(request, exc):
        code, message = errors[type(exc)]
        return JSONResponse(status_code=code, content={"detail": message})

    for error in errors:
        app.add_exception_handler(error, known_error)

    @app.exception_handler(InvalidDocument)
    async def invalid_document(request, exc):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    async def unavailable(request, exc):
        logging.getLogger("career").error("Infrastructure unavailable: %s", type(exc).__name__)
        return JSONResponse(
            status_code=503, content={"detail": "Storage is temporarily unavailable."}
        )

    app.add_exception_handler(RedisError, unavailable)
    app.add_exception_handler(SQLAlchemyError, unavailable)
