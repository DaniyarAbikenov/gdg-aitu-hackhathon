from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from pathlib import PurePath
from typing import Any

from app.application.ports import DocumentProcessor, ResumeRepository, ResumeReviewer, SessionStore
from app.domain import master
from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument, NotFound
from app.domain.models import ResumeFields, ResumeRecord, Session


class ResumeService:
    def __init__(
        self,
        repository: ResumeRepository,
        store: CareerRepository,
        sessions: SessionStore,
        reviewer: ResumeReviewer,
        documents: DocumentProcessor,
        max_upload_bytes: int,
    ):
        self.repository = repository
        self.store = store
        self.sessions = sessions
        self.reviewer = reviewer
        self.documents = documents
        self.max_upload_bytes = max_upload_bytes

    def library(self, session: Session) -> list[ResumeRecord]:
        return self.repository.list(session.owner)

    def get(self, session: Session, resume_id: str) -> ResumeRecord:
        return self.repository.get(session.owner, resume_id)

    def delete(self, session: Session, resume_id: str) -> None:
        self.repository.delete(session.owner, resume_id)

    def upload(self, session: Session, filename: str, data: bytes) -> ResumeRecord:
        if len(data) > self.max_upload_bytes:
            raise InvalidDocument("Upload exceeds the configured size limit.")
        filename = PurePath(filename.replace("\\", "/")).name[:180]
        fields = self.documents.extract(filename, data)
        return self.repository.create(session, filename, fields)

    def create(
        self,
        session: Session,
        *,
        title: str,
        position: str,
        job: str,
        sections: list[str],
        use_ai: bool,
        facts: str,
        vacancy_id: str | None,
        validate: Callable[[dict[str, Any]], ResumeFields],
        selection: dict[str, list[str]] | None = None,
    ) -> dict[str, Any]:
        """A new resume linked to the selected profile facts, optionally composed by AI.

        `validate` applies the external resume contract to AI or profile data.
        `selection` narrows a section to chosen entries; a missing section means all.
        """
        if vacancy_id:
            self.store.get("vacancy", session.owner, vacancy_id)
        try:
            record = self.store.get("profile", session.owner, session.owner)
            profile, profile_revision = record.data, record.revision
        except NotFound:
            profile, profile_revision = {}, 0
        selected = master.select(profile, sections, selection)
        fields = {**selected, "position": position}
        if use_ai:
            self.sessions.consume_analysis(session)
            result = self.documents.compose(fields, position, job, facts)
            if result["questions"]:
                return {"questions": result["questions"]}
            fields = master.restore_ids(selected, result["fields"])
        if vacancy_id:
            # The vacancy may have been deleted during a slow provider call.
            self.store.get("vacancy", session.owner, vacancy_id)
        valid = validate(fields)
        resume = self.repository.create(
            session,
            "Created resume",
            valid,
            title=title,
            description=job[:2000],
            vacancy_id=vacancy_id,
            profile_link=master.build_link(profile, profile_revision, asdict(valid)),
        )
        return {"resume": resume, "questions": []}

    def save(
        self, session: Session, resume_id: str, revision: int, fields: ResumeFields
    ) -> ResumeRecord:
        # Any edit invalidates recommendations tied to an earlier version.
        return self.repository.save(session.owner, resume_id, revision, fields)

    def update_metadata(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        title: str,
        description: str,
        lifecycle: str,
    ) -> ResumeRecord:
        return self.repository.metadata(
            session.owner, resume_id, revision, title, description, lifecycle
        )

    def analyze(
        self, session: Session, resume_id: str, revision: int, jd_text: str
    ) -> ResumeRecord:
        record = self.repository.get(session.owner, resume_id)
        if record.revision != revision:
            raise Conflict
        if record.analysis and record.jd_text == jd_text:
            return record
        self.sessions.consume_analysis(session)
        analysis = self.reviewer.analyze(record.fields, jd_text)
        # The repository performs an atomic revision check after a slow provider call.
        return self.repository.review(session.owner, resume_id, revision, analysis, jd_text)

    def assessment(self, session: Session, resume_id: str) -> dict[str, Any] | None:
        resume = self.repository.get(session.owner, resume_id)
        for item in self.store.list("assessment", session.owner):
            if (
                item.data["resume_id"] == resume_id
                and item.data["resume_revision"] == resume.revision
            ):
                return item.data
        return None

    def versions(self, session: Session, resume_id: str) -> list[CareerRecord]:
        self.repository.get(session.owner, resume_id)
        return [
            v for v in self.store.list("version", session.owner) if v.data["resume_id"] == resume_id
        ]

    def export(self, session: Session, resume_id: str, template: str = "modern") -> bytes:
        return self.documents.pdf(self.repository.get(session.owner, resume_id).fields, template)

    def export_docx(self, session: Session, resume_id: str) -> bytes:
        return self.documents.docx(self.repository.get(session.owner, resume_id).fields)

    def export_version(self, session: Session, version_id: str, format: str) -> bytes:
        version = self.store.get("version", session.owner, version_id)
        fields = ResumeFields(**version.data["fields"])
        return self.documents.docx(fields) if format == "docx" else self.documents.pdf(fields)
