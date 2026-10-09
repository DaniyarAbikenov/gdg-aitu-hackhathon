from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from app.application.ports import ActivityLog, ResumeRepository, SessionStore
from app.domain.career import CareerRepository, PasswordHasher, RecordKind
from app.domain.errors import Forbidden, InvalidDocument
from app.domain.models import Session

EXPORTED_KINDS: list[RecordKind] = [
    "profile",
    "preferences",
    "company",
    "vacancy",
    "assessment",
    "interview",
    "plan",
    "version",
    "reward",
]


class Accounts:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        passwords: PasswordHasher,
        activity: ActivityLog,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.passwords, self.activity = passwords, activity

    def verify(self, session: Session, password: str, client_id: str) -> dict[str, Any]:
        self.sessions.consume_auth(client_id)
        account = self.store.account_for_owner(session.owner)
        if not account["password_hash"]:
            raise InvalidDocument(
                "This account uses Google sign-in. Password management is unavailable."
            )
        if not self.passwords.verify(password, account["password_hash"]):
            raise Forbidden("Incorrect current password.", code="wrong_password")
        return account

    def change_password(
        self, session: Session, password: str, new_password: str, client_id: str
    ) -> None:
        self.verify(session, password, client_id)
        self.store.change_password(
            session.owner, session.auth_version, self.passwords.hash(new_password)
        )

    def delete(self, session: Session, password: str, email: str, client_id: str) -> None:
        account = self.verify(session, password, client_id)
        if account["email"] != email.strip().casefold():
            raise InvalidDocument("Type the account email to confirm deletion.")
        self.store.delete_account(session.owner, session.auth_version)

    def export(self, session: Session) -> dict[str, Any]:
        return {
            "format_version": 1,
            "exported_at": datetime.now(UTC).isoformat(),
            "email": self.store.email_for_owner(session.owner),
            "resumes": [asdict(r) for r in self.resumes.list(session.owner)],
            "activity": self.activity.list(session.owner),
            **{
                kind: [asdict(r) for r in self.store.list(kind, session.owner)]
                for kind in EXPORTED_KINDS
            },
        }
