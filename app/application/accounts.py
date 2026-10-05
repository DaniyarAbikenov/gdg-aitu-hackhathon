from dataclasses import asdict
from datetime import UTC, datetime

from app.domain.errors import InvalidDocument, NotFound


class Accounts:
    def __init__(self, career, activity):
        self.career, self.activity = career, activity

    def verify(self, session, password, client_id):
        self.career.sessions.consume_auth(client_id)
        account = self.career.store.account_for_owner(session.owner)
        if not account["password_hash"]:
            raise InvalidDocument(
                "This account uses Google sign-in. Password management is unavailable."
            )
        if not self.career.passwords.verify(password, account["password_hash"]):
            raise NotFound
        return account

    def change_password(self, session, password, new_password, client_id):
        self.verify(session, password, client_id)
        self.career.store.change_password(
            session.owner, session.auth_version, self.career.passwords.hash(new_password)
        )

    def delete(self, session, password, email, client_id):
        account = self.verify(session, password, client_id)
        if account["email"] != email.strip().casefold():
            raise InvalidDocument("Type the account email to confirm deletion.")
        self.career.store.delete_account(session.owner, session.auth_version)

    def export(self, session):
        return {
            "format_version": 1,
            "exported_at": datetime.now(UTC).isoformat(),
            "email": self.career.store.email_for_owner(session.owner),
            "resumes": [asdict(r) for r in self.career.resumes.list(session.owner)],
            "activity": self.activity.list(session.owner),
            **{
                kind: [asdict(r) for r in self.career.store.list(kind, session.owner)]
                for kind in [
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
            },
        }
