"""Extract a reviewable profile draft without mutating saved candidate facts."""

from dataclasses import asdict
from pathlib import PurePath

from app.domain.errors import InvalidDocument


class ProfileImport:
    def __init__(self, documents, sessions, max_upload_bytes):
        self.documents = documents
        self.sessions = sessions
        self.max_upload_bytes = max_upload_bytes

    def preview(self, session, filename, data):
        filename = PurePath(filename.replace("\\", "/")).name[:180]
        if PurePath(filename).suffix.lower() != ".pdf" or not data.startswith(b"%PDF-"):
            raise InvalidDocument("Choose a valid PDF resume.")
        if len(data) > self.max_upload_bytes:
            raise InvalidDocument("Upload exceeds the configured size limit.")
        self.sessions.consume_analysis(session)
        return {"filename": filename, "fields": asdict(self.documents.extract(filename, data))}
