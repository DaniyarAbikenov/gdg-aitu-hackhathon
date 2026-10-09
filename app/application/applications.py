"""A saved vacancy is the shared context for the preparation journey."""

from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from app.application.career import CareerService
from app.application.ports import VacancyParser
from app.domain.career import CareerRecord
from app.domain.errors import Conflict, InvalidDocument
from app.domain.models import Session

MIN_PASTED_VACANCY = 60


class Applications:
    def __init__(self, career: CareerService, parser: VacancyParser):
        self.career = career
        self.store = career.store
        self.parser = parser

    def import_draft(self, session: Session, url: str, text: str, language: str) -> dict[str, Any]:
        """Turn a link or pasted text into a reviewable draft; nothing is saved."""
        text = text.strip()
        if not url and len(text) < MIN_PASTED_VACANCY:
            raise InvalidDocument(
                "Paste a vacancy link or at least 60 characters of text.",
                code="vacancy_import_failed",
            )
        self.career.sessions.consume_analysis(session)
        return self.parser.parse(url, text, language)

    def save(
        self,
        session: Session,
        data: dict[str, Any],
        record_id: str | None = None,
        revision: int = 0,
    ) -> CareerRecord:
        if data.get("resume_id"):
            self.career.resumes.get(session.owner, data["resume_id"])
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
        company_key = " ".join(data["company_name"].casefold().split())
        company = next(
            (
                c
                for c in self.store.list("company", session.owner)
                if " ".join(c.data["name"].casefold().split()) == company_key
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

    def list(self, session: Session) -> list[dict[str, Any]]:
        companies = {c.id: c.data for c in self.store.list("company", session.owner)}
        interviews = self.store.list("interview", session.owner)
        plans = self.store.list("plan", session.owner)
        resumes = {r.resume_id: r for r in self.career.resumes.list(session.owner)}
        results = []
        for record in self.store.list("vacancy", session.owner):
            data = {
                "status": "saved",
                "company_name": "",
                "company_description": "",
                "source_url": "",
                "notes": "",
                "next_action": "",
                "follow_up": "",
                "resume_id": "",
                "skills": [],
                **record.data,
            }
            company = companies.get(data.get("company_id") or "", {})
            data["company_name"] = company.get("name") or data["company_name"]
            data["company_description"] = company.get("description") or data["company_description"]
            related_interviews = [
                i for i in interviews if i.data["context"].get("vacancy_id") == record.id
            ]
            related_plans = [p for p in plans if p.data.get("vacancy_id") == record.id]
            resume = resumes.get(data["resume_id"])
            next_step_key = "custom"
            if data["status"] in {"offer", "rejected", "archived"}:
                next_step = "Подведите итоги и сохраните полезные выводы."
                next_step_key = "wrapUp"
            elif data["next_action"]:
                next_step = data["next_action"]
            elif not resume:
                next_step = "Выберите резюме для этой вакансии."
                next_step_key = "chooseResume"
            elif not related_interviews:
                next_step = "Пройдите тренировку по требованиям вакансии."
                next_step_key = "practice"
            elif not any(i.data["finished"] for i in related_interviews):
                next_step = "Завершите начатую тренировку."
                next_step_key = "finish"
            elif not related_plans:
                next_step = "Составьте план по результатам подготовки."
                next_step_key = "plan"
            else:
                next_step = "Запланируйте отклик или следующий контакт."
                next_step_key = "contact"
            results.append(
                {
                    **asdict(record),
                    "data": data,
                    "next_step": next_step,
                    "next_step_key": next_step_key,
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
