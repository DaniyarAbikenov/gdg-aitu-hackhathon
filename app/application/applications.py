"""A saved vacancy is the shared context for the preparation journey."""

from dataclasses import asdict
from datetime import UTC, date, datetime
from typing import Any, Literal

from app.application.calendar import CalendarEvent, calendar
from app.application.ports import ResumeRepository, SessionStore, VacancyParser
from app.application.profile import ProfileService
from app.domain.career import CareerCoach, CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument
from app.domain.funnel import next_action, record_stage
from app.domain.letter import candidate_facts, skill_match
from app.domain.models import Session
from app.domain.vacancy import CLOSED_STATUSES, VACANCY_DEFAULTS, company_key, next_step

MIN_PASTED_VACANCY = 60
TargetKind = Literal["company", "vacancy"]


class Applications:
    def __init__(
        self,
        store: CareerRepository,
        resumes: ResumeRepository,
        sessions: SessionStore,
        parser: VacancyParser,
        coach: CareerCoach,
        profiles: ProfileService,
    ):
        self.store, self.resumes, self.sessions = store, resumes, sessions
        self.parser, self.coach, self.profiles = parser, coach, profiles

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
        now = datetime.now(UTC).isoformat()
        previous_status = None
        if record_id:
            current = self.store.get("vacancy", session.owner, record_id)
            if current.revision != revision:
                raise Conflict
            previous_status = current.data.get("status", "saved")
            # Preserve fields created by earlier versions and interview catalogs.
            data = {**current.data, **data}
        elif revision:
            raise InvalidDocument("A new vacancy starts at revision zero.")
        if data.get("status", "saved") != previous_status:
            data["stages"] = record_stage(data.get("stages"), data.get("status", "saved"), now)
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
        data["updated_at"] = now
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
                rejection_reviewed=bool(data.get("rejection")),
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
                    "rejection_action": next_action(data["rejection"])
                    if data["status"] == "rejected" and data.get("rejection")
                    else None,
                }
            )
        return results

    def targets(self, session: Session, kind: TargetKind) -> list[CareerRecord]:
        return self.store.list(kind, session.owner)

    def save_target(self, session: Session, kind: TargetKind, data: dict[str, Any]) -> CareerRecord:
        if data.get("company_id"):
            self.store.get("company", session.owner, data["company_id"])
        return self.store.create(kind, session, data)

    def cover_letter(self, session: Session, vacancy_id: str, language: str) -> dict[str, Any]:
        """A draft from confirmed facts only. It is saved when the user accepts it in the form."""
        vacancy = {**VACANCY_DEFAULTS, **self.store.get("vacancy", session.owner, vacancy_id).data}
        resume = (
            asdict(self.resumes.get(session.owner, vacancy["resume_id"]).fields)
            if vacancy["resume_id"]
            else None
        )
        facts = candidate_facts(self.profiles.data(session), resume)
        if not any(facts[k] for k in ("summary", "skills", "experience", "projects")):
            raise InvalidDocument(
                "Fill in your profile or choose a resume for this vacancy first.",
                code="letter_needs_facts",
            )
        matched, missing = skill_match(facts, vacancy)
        self.sessions.consume_analysis(session)
        context = {
            k: vacancy[k] for k in ("name", "company_name", "description", "skills") if k in vacancy
        } | {k: vacancy.get(k, []) for k in ("requirements", "responsibilities")}
        letter = self.coach.cover_letter(facts, context, matched, missing, language)
        return {
            **letter,
            "matched_skills": matched,
            "missing_skills": missing,
            "resume_id": vacancy["resume_id"] or None,
        }

    def follow_ups(self, session: Session) -> str:
        """Open applications with a next-contact date, as an iCalendar feed."""
        events = []
        for record in self.store.list("vacancy", session.owner):
            data = {**VACANCY_DEFAULTS, **record.data}
            if not data["follow_up"] or data["status"] in CLOSED_STATUSES:
                continue
            company = data["company_name"]
            events.append(
                CalendarEvent(
                    uid=f"{record.id}-follow-up@career-studio",
                    day=date.fromisoformat(str(data["follow_up"])[:10]),
                    summary=f"{data.get('name', '')} — {company}"
                    if company
                    else data.get("name", ""),
                    description=data["next_action"],
                )
            )
        return calendar("Career Studio", events)
