"""Domain errors carry a stable machine-readable code; clients translate by code."""


class DomainError(Exception):
    code = "error"

    def __init__(self, message: str = "", *, code: str | None = None):
        super().__init__(message)
        if code:
            self.code = code

    @property
    def message(self) -> str:
        return str(self.args[0]) if self.args and self.args[0] else ""


class NotFound(DomainError):
    code = "not_found"


class Conflict(DomainError):
    code = "conflict"


class QuotaExceeded(DomainError):
    code = "rate_limited"


class InvalidDocument(DomainError):
    code = "invalid_input"


class ProviderUnavailable(DomainError):
    code = "provider_unavailable"


class Unauthenticated(DomainError):
    """The caller must sign in again or present different credentials."""

    code = "sign_in_required"


class Forbidden(DomainError):
    """The caller is known but may not perform this action."""

    code = "forbidden"
