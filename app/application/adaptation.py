"""Vacancy-specific resume proposals, accepted explicitly and kept as versions."""

import json
from dataclasses import asdict
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.application.ports import ResumeRepository, SessionStore
from app.application.profile import ProfileService
from app.domain.career import CareerCoach, CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument, NotFound
from app.domain.models import ResumeFields, ResumeRecord, Session
from app.domain.review import compare


class ResumeAdaptation:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        coach: CareerCoach,
        profiles: ProfileService,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.coach, self.profiles = coach, profiles

    def assessment(self, session: Session, resume_id: str) -> CareerRecord | None:
        return next(
            (
                a
                for a in self.store.list("assessment", session.owner)
                if a.data["resume_id"] == resume_id
            ),
            None,
        )

    def adapt(self, session: Session, resume_id: str, revision: int, job: str) -> dict[str, Any]:
        resume = self.resumes.get(session.owner, resume_id)
        if resume.revision != revision:
            raise Conflict
        self.sessions.consume_analysis(session)
        result = self.coach.improvements(asdict(resume.fields), self.profiles.data(session), job)
        assessment = {
            "resume_id": resume_id,
            "resume_revision": revision,
            "missing_skills": compare(resume.fields, job).missing_skills,
            "job": job,
            "improvements": result["improvements"],
        }
        previous = self.assessment(session, resume_id)
        if previous:
            self.store.update(
                "assessment", session.owner, previous.id, previous.revision, assessment
            )
        else:
            # A stable id keeps one assessment per resume under concurrent requests.
            stable_id = str(uuid5(NAMESPACE_URL, session.owner + ":assessment:" + resume_id))
            self.store.create("assessment", session, assessment, stable_id)
        return {**result, "revision": revision, "jd_text": job}

    def apply_proposal(
        self, session: Session, resume_id: str, revision: int, proposal_id: str
    ) -> CareerRecord:
        resume = self.resumes.get(session.owner, resume_id)
        assessment = self.assessment(session, resume_id)
        if (
            resume.revision != revision
            or not assessment
            or assessment.data["resume_revision"] != revision
        ):
            raise Conflict
        proposal = next(
            (p for p in assessment.data["improvements"] if p["id"] == proposal_id), None
        )
        if not proposal:
            raise NotFound
        section = proposal["section"]
        fields = asdict(resume.fields)
        fields[section] = self.proposed_value(section, proposal["after"], fields[section])
        remaining = {
            **assessment.data,
            "resume_revision": revision + 1,
            "missing_skills": compare(
                ResumeFields(**fields), assessment.data["job"]
            ).missing_skills,
            "improvements": [p for p in assessment.data["improvements"] if p["section"] != section],
        }
        return self.store.apply_proposal(
            session,
            resume_id,
            revision,
            assessment.id,
            assessment.revision,
            fields,
            remaining,
            section,
        )

    @staticmethod
    def proposed_value(section: str, after: str, current: Any) -> Any:
        if section == "skills":
            return [v.strip() for v in after.split(",") if v.strip()]
        if isinstance(current, list):
            try:
                return json.loads(after)
            except ValueError as exc:
                raise InvalidDocument(
                    "The suggested section is invalid. Request a new analysis."
                ) from exc
        return after

    def save_version(
        self,
        session: Session,
        resume_id: str,
        revision: int,
        fields: dict[str, Any],
        label: str,
        job: str,
    ) -> CareerRecord:
        # Version creation does not overwrite the source resume; restore is a separate CAS step.
        original = self.resumes.get(session.owner, resume_id)
        if original.revision != revision:
            raise Conflict
        return self.store.create(
            "version",
            session,
            {
                "resume_id": resume_id,
                "label": label,
                "fields": fields,
                "before": asdict(original.fields),
                "jd_text": job,
            },
        )

    def restore_version(self, session: Session, version_id: str, revision: int) -> ResumeRecord:
        version = self.store.get("version", session.owner, version_id)
        return self.resumes.save(
            session.owner,
            version.data["resume_id"],
            revision,
            ResumeFields(**version.data["fields"]),
        )

    def delete_version(self, session: Session, version_id: str) -> None:
        self.store.delete("version", session.owner, version_id)
