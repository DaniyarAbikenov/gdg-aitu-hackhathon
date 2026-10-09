"""Every error response has the shape {"detail": <message>, "code": <stable code>}."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError

from app.domain.errors import (
    Conflict,
    DomainError,
    Forbidden,
    InvalidDocument,
    NotFound,
    ProviderUnavailable,
    QuotaExceeded,
    Unauthenticated,
)


class ApiError(Exception):
    """A transport-level failure raised by a router (size limits, malformed uploads)."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def error_response(status: int, code: str, message: str, **extra: object) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message, "code": code, **extra})


STATUS: dict[type[DomainError], int] = {
    NotFound: 404,
    Conflict: 409,
    QuotaExceeded: 429,
    InvalidDocument: 422,
    ProviderUnavailable: 502,
    Unauthenticated: 401,
    Forbidden: 403,
}

# Codes whose HTTP status differs from their error class.
STATUS_BY_CODE = {"google_unavailable": 503}

DEFAULT_MESSAGES: dict[type[DomainError], str] = {
    NotFound: "Resume not found.",
    Conflict: "This resume changed in another tab. Reload it before continuing.",
    QuotaExceeded: (
        "Request or workspace limit reached. Try again later, or remove unused saved items."
    ),
    ProviderUnavailable: (
        "AI processing is temporarily unavailable. Please retry later. "
        "Your saved data is unchanged."
    ),
    Unauthenticated: "Sign in to continue.",
    Forbidden: "Action unavailable.",
    InvalidDocument: "Check the form values.",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(
            422,
            "validation_failed",
            "Check the form values.",
            errors=[
                {"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()
            ],
        )

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        kind = next(k for k in type(exc).__mro__ if k in STATUS)
        status = STATUS_BY_CODE.get(exc.code, STATUS[kind])
        return error_response(status, exc.code, exc.message or DEFAULT_MESSAGES[kind])

    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message)

    async def unavailable(request: Request, exc: Exception) -> JSONResponse:
        logging.getLogger("career").error("Infrastructure unavailable: %s", type(exc).__name__)
        return error_response(503, "storage_unavailable", "Storage is temporarily unavailable.")

    async def unexpected(request: Request, exc: Exception) -> JSONResponse:
        return error_response(500, "internal_error", "Something went wrong. Please try again.")

    app.add_exception_handler(RedisError, unavailable)
    app.add_exception_handler(SQLAlchemyError, unavailable)
    app.add_exception_handler(Exception, unexpected)
