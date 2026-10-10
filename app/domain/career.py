"""Career aggregate contracts: no framework or persistence dependencies."""

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from app.domain.models import ResumeRecord, Session

RecordKind = Literal[
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


@dataclass
class CareerRecord:
    id: str
    revision: int
    data: dict[str, Any]
    created_at: str


class CareerRepository(Protocol):
    def create(
        self, kind: RecordKind, session: Session, data: dict, record_id: str | None = None
    ) -> CareerRecord: ...
    def get(self, kind: RecordKind, owner: str, record_id: str) -> CareerRecord: ...
    def list(self, kind: RecordKind, owner: str) -> list[CareerRecord]: ...
    def update(
        self, kind: RecordKind, owner: str, record_id: str, revision: int, data: dict
    ) -> CareerRecord: ...
    def apply_proposal(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        assessment_id: str,
        assessment_revision: int,
        fields: dict,
        remaining: dict,
        section: str,
    ) -> CareerRecord: ...
    def sync_resume(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        fields: dict,
        link: dict,
        label: str,
    ) -> ResumeRecord: ...
    def delete(self, kind: RecordKind, owner: str, record_id: str) -> None: ...
    def clear(self, owner: str) -> None: ...
    def register(self, email: str, password_hash: str, owner: str) -> None: ...
    def account(self, email: str) -> dict: ...
    def account_for_owner(self, owner: str) -> dict: ...
    def email_for_owner(self, owner: str) -> str: ...
    def change_password(self, owner: str, auth_version: int, password_hash: str) -> None: ...
    def verify_email(self, owner: str, email: str) -> None: ...
    def delete_account(self, owner: str, auth_version: int) -> None: ...
    def promote(self, owner: str) -> None: ...
    def google_account(self, subject: str, email: str, guest_owner: str) -> str: ...


class CareerCoach(Protocol):
    def improvements(self, fields: dict, profile: dict, job: str) -> dict: ...
    def questions(self, context: dict) -> dict: ...
    def evaluate(self, context: dict, question: dict, answer: str) -> dict: ...
    def plan(self, profile: dict, goal: str, gaps: list[str]) -> dict: ...
    def cover_letter(
        self, facts: dict, vacancy: dict, matched: list[str], missing: list[str], language: str
    ) -> dict: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...
    def verify(self, password: str, encoded: str) -> bool: ...
