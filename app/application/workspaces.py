"""Session lifecycle: resolving cookies to workspaces, guest workspaces and sign-out."""

from app.application.ports import ResumeRepository, SessionStore
from app.domain.career import CareerRepository
from app.domain.errors import Forbidden, NotFound, Unauthenticated
from app.domain.models import Session


class Workspaces:
    def __init__(self, sessions: SessionStore, resumes: ResumeRepository, store: CareerRepository):
        self.sessions, self.resumes, self.store = sessions, resumes, store

    def resolve(self, token: str | None) -> Session:
        """Return the active session; revoked or expired sessions must sign in again."""
        try:
            session = self.sessions.resolve(token)
            if session.persistent:
                account = self.store.account_for_owner(session.owner)
                if account["auth_version"] != session.auth_version:
                    raise NotFound
            return session
        except NotFound as exc:
            raise Unauthenticated(
                "Your session expired. Start a new workspace.", code="session_expired"
            ) from exc

    def member(self, token: str | None) -> Session:
        session = self.resolve(token)
        if not session.persistent:
            raise Unauthenticated("Sign in to continue.")
        return session

    def open(self, token: str | None, client_id: str) -> str | None:
        """Keep a valid session, otherwise start a guest one and return its new token."""
        try:
            self.sessions.resolve(token)
            return None
        except NotFound:
            return self.sessions.create(client_id)

    def end_guest(self, session: Session, token: str) -> None:
        if session.persistent:
            raise Forbidden("Use account settings to delete registered data.")
        self.resumes.delete_owner(session.owner)
        self.store.clear(session.owner)
        self.sessions.delete(token)

    def sign_out(self, token: str | None) -> None:
        if token:
            self.sessions.delete(token)

    def health(self) -> None:
        self.resumes.health()
        self.sessions.health()
