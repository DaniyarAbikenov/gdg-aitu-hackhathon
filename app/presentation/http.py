from urllib.parse import urlsplit

from app.presentation.errors import error_response, install_error_handlers


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
                response = error_response(413, "payload_too_large", "Upload is too large.")
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
                return error_response(403, "cross_origin", "Cross-origin request denied.")
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

    install_error_handlers(app)
