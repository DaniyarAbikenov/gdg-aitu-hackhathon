"""Keeps resumes in step with the master profile without overwriting deliberate edits."""

from dataclasses import asdict
from typing import Any

from app.application.ports import ResumeRepository
from app.domain import master
from app.domain.career import CareerRepository
from app.domain.demand import demand
from app.domain.errors import NotFound
from app.domain.models import ResumeRecord, Session


class LinkedResumes:
    def __init__(self, store: CareerRepository, resumes: ResumeRepository):
        self.store, self.resumes = store, resumes

    def _profile(self, session: Session) -> tuple[dict[str, Any], int]:
        try:
            record = self.store.get("profile", session.owner, session.owner)
        except NotFound:
            return {}, 0
        return record.data, record.revision

    def _demand(self, session: Session) -> dict[str, int]:
        counts, _ = demand(v.data for v in self.store.list("vacancy", session.owner))
        return dict(counts)

    def changes(self, session: Session, resume_id: str) -> dict[str, Any]:
        resume = self.resumes.get(session.owner, resume_id)
        profile, revision = self._profile(session)
        changes = master.plan(
            profile, asdict(resume.fields), resume.profile_link, self._demand(session)
        )
        return {
            "resume_id": resume_id,
            "revision": resume.revision,
            "profile_revision": revision,
            "linked": resume.profile_link is not None,
            "status": master.status(changes),
            "changes": changes,
        }

    def statuses(self, session: Session) -> dict[str, str]:
        """One word per resume for the library: current, suggestions, outdated or review."""
        profile, _ = self._profile(session)
        result = {}
        for resume in self.resumes.list(session.owner):
            changes = master.plan(profile, asdict(resume.fields), resume.profile_link)
            result[resume.resume_id] = master.status(changes)
        return result

    def apply(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        accept: list[str],
        dismiss: list[str],
        label: str,
    ) -> ResumeRecord:
        resume = self.resumes.get(session.owner, resume_id)
        profile, profile_revision = self._profile(session)
        fields, link = master.apply(
            profile,
            profile_revision,
            asdict(resume.fields),
            resume.profile_link,
            accept,
            dismiss,
        )
        return self.store.sync_resume(session, resume_id, revision, fields, link, label)
