"""Sign-in flows and administrator policy; tokens are opaque to the caller."""

from dataclasses import dataclass

from app.application.ports import IdentityVerifier, SessionStore
from app.domain.career import CareerRepository, PasswordHasher
from app.domain.errors import (
    Conflict,
    Forbidden,
    InvalidDocument,
    NotFound,
    ProviderUnavailable,
    Unauthenticated,
)
from app.domain.models import Session


@dataclass(frozen=True)
class Administrators:
    emails: frozenset[str]

    @classmethod
    def parse(cls, value: str) -> "Administrators":
        return cls(frozenset(e.strip().casefold() for e in value.split(",") if e.strip()))

    def includes(self, email: str) -> bool:
        return email.strip().casefold() in self.emails


class Auth:
    def __init__(
        self,
        store: CareerRepository,
        sessions: SessionStore,
        passwords: PasswordHasher,
        google: IdentityVerifier,
        administrators: Administrators,
        google_enabled: bool,
    ):
        self.store, self.sessions, self.passwords = store, sessions, passwords
        self.google, self.administrators = google, administrators
        self.google_enabled = google_enabled

    def register(self, session: Session, email: str, password: str, client_id: str) -> str:
        if self.administrators.includes(email):
            raise Forbidden("This administrator address must be provisioned on the server.")
        self.sessions.consume_auth(client_id)
        if session.persistent:
            raise InvalidDocument("Sign out before registering another account.", code="signed_in")
        try:
            self.store.register(email, self.passwords.hash(password), session.owner)
        except Conflict as exc:
            raise Conflict(
                "Account already exists. Sign in instead.", code="account_exists"
            ) from exc
        return self.sessions.create(client_id, owner=session.owner)

    def login(self, email: str, password: str, client_id: str) -> str:
        self.sessions.consume_auth(client_id)
        try:
            account = self.store.account(email)
        except NotFound:
            # Spend the same password KDF work for unknown accounts.
            self.passwords.hash(password)
            raise self.invalid_credentials() from None
        if not self.passwords.verify(password, account["password_hash"]):
            raise self.invalid_credentials()
        return self.sessions.create(
            client_id, owner=account["owner"], auth_version=account["auth_version"]
        )

    @staticmethod
    def invalid_credentials() -> Unauthenticated:
        return Unauthenticated("Incorrect email or password.", code="invalid_credentials")

    def google_nonce(self, session: Session, client_id: str) -> str:
        self.require_google(session)
        self.sessions.consume_auth(client_id)
        return self.sessions.google_nonce(session.owner)

    def google_sign_in(self, session: Session, credential: str, client_id: str) -> str:
        self.require_google(session)
        try:
            nonce = self.sessions.consume_google_nonce(session.owner)
            identity = self.google.verify(credential, nonce)
            owner = self.store.google_account(identity["subject"], identity["email"], session.owner)
        except NotFound as exc:
            raise Unauthenticated(
                "Google sign-in expired or could not be verified. Try again.",
                code="google_sign_in_failed",
            ) from exc
        except Conflict as exc:
            raise Conflict(
                "An account with this email exists. Use its original sign-in method.",
                code="account_exists",
            ) from exc
        account = self.store.account_for_owner(owner)
        return self.sessions.create(client_id, owner=owner, auth_version=account["auth_version"])

    def require_google(self, session: Session) -> None:
        if not self.google_enabled:
            raise ProviderUnavailable(
                "Google sign-in is not configured on this server.", code="google_unavailable"
            )
        if session.persistent:
            raise Conflict("Sign out before switching accounts.", code="signed_in")

    def email(self, session: Session) -> str:
        return self.store.email_for_owner(session.owner) if session.persistent else ""

    def is_admin(self, session: Session) -> bool:
        return session.persistent and self.administrators.includes(self.email(session))

    def require_admin(self, session: Session) -> Session:
        if not self.is_admin(session):
            raise Forbidden("Administrator access required.", code="admin_only")
        return session

    def has_password(self, session: Session) -> bool:
        return bool(self.store.account_for_owner(session.owner)["password_hash"])
