from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Protocol

from app.domain.models import Analysis, ResumeFields, ResumeRecord, Session


class ResumeRepository(Protocol):
    def create(
        self,
        session: Session,
        filename: str,
        fields: ResumeFields,
        *,
        title: str | None = None,
        description: str = "",
        vacancy_id: str | None = None,
    ) -> ResumeRecord: ...
    def get(self, owner: str, resume_id: str) -> ResumeRecord: ...
    def list(self, owner: str) -> list[ResumeRecord]: ...
    def metadata(
        self,
        owner: str,
        resume_id: str,
        revision: int,
        title: str,
        description: str,
        lifecycle: str,
    ) -> ResumeRecord: ...
    def save(
        self, owner: str, resume_id: str, revision: int, fields: ResumeFields
    ) -> ResumeRecord: ...
    def review(
        self, owner: str, resume_id: str, revision: int, analysis: Analysis, jd_text: str
    ) -> ResumeRecord: ...
    def delete(self, owner: str, resume_id: str) -> None: ...
    def delete_owner(self, owner: str) -> None: ...
    def purge_expired(self, now: datetime) -> int: ...
    def health(self) -> None: ...


class SessionStore(Protocol):
    def create(self, client_id: str, owner: str | None = None, auth_version: int = 0) -> str: ...
    def resolve(self, token: str | None) -> Session: ...
    def delete(self, token: str) -> None: ...
    def consume_analysis(self, session: Session) -> None: ...
    def consume_auth(self, client_id: str) -> None: ...
    def consume_skill(self, session: Session) -> None: ...
    def google_nonce(self, owner: str) -> str: ...
    def consume_google_nonce(self, owner: str) -> str: ...
    def exclusive(self, name: str, seconds: int) -> AbstractContextManager[bool]: ...
    def consume_mail(self, address: str) -> None: ...
    def issue_token(self, purpose: str, value: dict[str, Any], seconds: int) -> str: ...
    def redeem_token(self, purpose: str, token: str) -> dict[str, Any]: ...
    def health(self) -> None: ...


class ResumeReviewer(Protocol):
    def analyze(self, fields: ResumeFields, jd_text: str) -> Analysis: ...


class DocumentProcessor(Protocol):
    def extract(self, filename: str, data: bytes) -> ResumeFields: ...
    def pdf(self, fields: ResumeFields, template: str = "modern") -> bytes: ...
    def docx(self, fields: ResumeFields) -> bytes: ...
    def compose(
        self, fields: dict[str, Any], position: str, job: str, facts: str
    ) -> dict[str, Any]: ...


class VacancyParser(Protocol):
    def parse(self, url: str, text: str, language: str) -> dict[str, Any]: ...


class VoiceGateway(Protocol):
    def connect(
        self, sdp: str, context: dict[str, Any], transcript: list[dict[str, Any]]
    ) -> dict[str, Any]: ...
    def stop(self, call_id: str) -> None: ...


@dataclass(frozen=True)
class AiCall:
    """One provider request: which task, how many tokens and how long it took."""

    provider: str
    model: str
    operation: str
    input_tokens: int
    output_tokens: int
    duration_ms: int
    succeeded: bool


class AiUsageLog(Protocol):
    def record(self, call: AiCall) -> None: ...
    def summary(self, since: datetime) -> dict[str, Any]: ...


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class Mailer(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class IdentityVerifier(Protocol):
    def verify(self, credential: str, nonce: str) -> dict[str, str]: ...


class KnowledgeStore(Protocol):
    def list(
        self, query: str, admin: bool = False, language: str | None = None
    ) -> list[dict[str, Any]]: ...
    def save(
        self, data: dict[str, Any], id: str | None = None, revision: int = 0
    ) -> dict[str, Any]: ...


class ActivityLog(Protocol):
    def list(self, owner: str) -> list[dict[str, Any]]: ...


JobStatus = Literal["queued", "running", "done", "failed"]


@dataclass(frozen=True)
class JobState:
    """A background operation. `result` or `error` is set once the job has ended."""

    id: str
    owner: str
    operation: str
    status: JobStatus
    result: Any = None
    error: dict[str, str] | None = None


class JobQueue(Protocol):
    def submit(self, owner: str, operation: str, payload: dict[str, Any]) -> str: ...
    def get(self, job_id: str) -> JobState | None: ...
