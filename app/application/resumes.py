from pathlib import PurePath

from app.application.ports import DocumentProcessor, ResumeRepository, ResumeReviewer, SessionStore
from app.domain.errors import Conflict, InvalidDocument
from app.domain.models import ResumeFields, Session


class ResumeService:
    def __init__(
        self,
        repository: ResumeRepository,
        sessions: SessionStore,
        reviewer: ResumeReviewer,
        documents: DocumentProcessor,
        max_upload_bytes: int,
    ):
        self.repository = repository
        self.sessions = sessions
        self.reviewer = reviewer
        self.documents = documents
        self.max_upload_bytes = max_upload_bytes

    def upload(self, session: Session, filename: str, data: bytes):
        if len(data) > self.max_upload_bytes:
            raise InvalidDocument("Upload exceeds the configured size limit.")
        filename = PurePath(filename.replace("\\", "/")).name[:180]
        fields = self.documents.extract(filename, data)
        return self.repository.create(session, filename, fields)

    def save(self, session: Session, resume_id: str, revision: int, fields: ResumeFields):
        # Any edit invalidates recommendations tied to an earlier version.
        return self.repository.save(session.owner, resume_id, revision, fields)

    def analyze(self, session: Session, resume_id: str, revision: int, jd_text: str):
        record = self.repository.get(session.owner, resume_id)
        if record.revision != revision:
            raise Conflict
        if record.analysis and record.jd_text == jd_text:
            return record
        self.sessions.consume_analysis(session)
        analysis = self.reviewer.analyze(record.fields, jd_text)
        # The repository performs an atomic revision check after a slow provider call.
        return self.repository.review(session.owner, resume_id, revision, analysis, jd_text)

    def export(self, session: Session, resume_id: str, template: str = "modern"):
        record = self.repository.get(session.owner, resume_id)
        return self.documents.pdf(record.fields, template)
