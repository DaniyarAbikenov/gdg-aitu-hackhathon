"""A saved vacancy is the shared context for the preparation journey."""

from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any, Literal

from app.application.ports import ResumeRepository, SessionStore, VacancyParser
from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument
from app.domain.models import Session
from app.domain.vacancy import VACANCY_DEFAULTS, company_key, next_step

MIN_PASTED_VACANCY = 60
TargetKind = Literal["company", "vacancy"]


class Applications:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        parser: VacancyParser,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.parser = parser

    def import_draft(self, session: Session, url: str, text: str, language: str) -> dict[str, Any]:
        """Turn a link or pasted text into a reviewable draft; nothing is saved."""
        text = text.strip()
        if not url and len(text) < MIN_PASTED_VACANCY:
            raise InvalidDocument(
                "Paste a vacancy link or at least 60 characters of text.",
                code="vacancy_import_failed",
            )
        self.sessions.consume_analysis(session)
        return self.parser.parse(url, text, language)

    def save(
        self,
        session: Session,
        data: dict[str, Any],
        record_id: str | None = None,
        revision: int = 0,
    ) -> CareerRecord:
        if data.get("resume_id"):
            self.resumes.get(session.owner, data["resume_id"])
        if data.get("company_id"):
            selected_company = self.store.get("company", session.owner, data["company_id"])
            data["company_name"] = selected_company.data["name"]
            data["company_description"] = selected_company.data.get("description", "")
        if record_id:
            current = self.store.get("vacancy", session.owner, record_id)
            if current.revision != revision:
                raise Conflict
            # Preserve fields created by earlier versions and interview catalogs.
            data = {**current.data, **data}
        elif revision:
            raise InvalidDocument("A new vacancy starts at revision zero.")
        key = company_key(data["company_name"])
        company = next(
            (
                c
                for c in self.store.list("company", session.owner)
                if company_key(c.data["name"]) == key
            ),
            None,
        )
        if not company:
            company = self.store.create(
                "company",
                session,
                {
                    "name": data["company_name"],
                    "description": data.get("company_description") or data["company_name"],
                    "skills": data.get("skills", []),
                },
            )
        data["company_id"] = company.id
        data["updated_at"] = datetime.now(UTC).isoformat()
        return (
            self.store.update("vacancy", session.owner, record_id, revision, data)
            if record_id
            else self.store.create("vacancy", session, data)
        )

    def board(self, session: Session) -> list[dict[str, Any]]:
        companies = {c.id: c.data for c in self.store.list("company", session.owner)}
        interviews = self.store.list("interview", session.owner)
        plans = self.store.list("plan", session.owner)
        resumes = {r.resume_id: r for r in self.resumes.list(session.owner)}
        results = []
        for record in self.store.list("vacancy", session.owner):
            data = {**VACANCY_DEFAULTS, **record.data}
            company = companies.get(data.get("company_id") or "", {})
            data["company_name"] = company.get("name") or data["company_name"]
            data["company_description"] = company.get("description") or data["company_description"]
            related_interviews = [
                i for i in interviews if i.data["context"].get("vacancy_id") == record.id
            ]
            related_plans = [p for p in plans if p.data.get("vacancy_id") == record.id]
            resume = resumes.get(data["resume_id"])
            step = next_step(
                data["status"],
                data["next_action"],
                has_resume=resume is not None,
                interviews_started=len(related_interviews),
                interviews_finished=sum(bool(i.data["finished"]) for i in related_interviews),
                plans=len(related_plans),
            )
            results.append(
                {
                    **asdict(record),
                    "data": data,
                    "next_step": step.text,
                    "next_step_key": step.key,
                    "resume_title": resume.title if resume else None,
                    "interviews": [
                        {
                            "id": i.id,
                            "finished": i.data["finished"],
                            "mode": i.data["context"].get("mode", "text"),
                            "score": i.data["score"],
                        }
                        for i in related_interviews
                    ],
                    "plans": [{"id": p.id, "goal": p.data["goal"]} for p in related_plans],
                }
            )
        return results

    def targets(self, session: Session, kind: TargetKind) -> list[CareerRecord]:
        return self.store.list(kind, session.owner)

    def save_target(self, session: Session, kind: TargetKind, data: dict[str, Any]) -> CareerRecord:
        if data.get("company_id"):
            self.store.get("company", session.owner, data["company_id"])
        return self.store.create(kind, session, data)
