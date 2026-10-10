"""What a candidate can learn about a company: its own website and other candidates' reports."""

from datetime import UTC, date, datetime, timedelta
from typing import Any

from app.application.auth import Auth
from app.application.ports import CompanyAnalyst, CompanySite, InterviewReports, SessionStore
from app.domain import company_research, reports
from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, Forbidden, InvalidDocument, QuotaExceeded
from app.domain.models import Session
from app.domain.vacancy import company_key


class CompanyInsights:
    def __init__(
        self,
        store: CareerRepository,
        sessions: SessionStore,
        site: CompanySite,
        analyst: CompanyAnalyst,
        reports: InterviewReports,
        auth: Auth,
    ):
        self.store, self.sessions, self.site = store, sessions, site
        self.analyst, self.reports, self.auth = analyst, reports, auth

    def research(
        self, session: Session, company_id: str, revision: int, language: str
    ) -> CareerRecord:
        """Read the company's website and keep only the facts that its pages support."""
        company = self.store.get("company", session.owner, company_id)
        if company.revision != revision:
            raise Conflict
        website = company.data.get("website")
        if not website:
            raise InvalidDocument("Add the company website first.", code="company_no_website")
        self.sessions.consume_analysis(session)
        pages = self.site.read(website)
        facts, dropped = company_research.verify(self.analyst.facts(pages, language), pages)
        research = {
            "fetched_at": datetime.now(UTC).isoformat(),
            "provider": self.analyst.provider,
            "sources": [page["url"] for page in pages],
            "facts": facts,
            "stack": company_research.stack(pages),
            "dropped": dropped,
        }
        return self.store.update(
            "company", session.owner, company_id, revision, {**company.data, "research": research}
        )

    def _key(self, session: Session, company_id: str) -> tuple[str, str]:
        name = self.store.get("company", session.owner, company_id).data["name"]
        return company_key(name), name

    def company_reports(self, session: Session, company_id: str) -> list[dict[str, Any]]:
        """Approved reports about this company from anyone, and the candidate's own."""
        key, _ = self._key(session, company_id)
        return [
            reports.public(r, session.owner) for r in self.reports.for_company(key, session.owner)
        ]

    def share(self, session: Session, company_id: str, report: dict[str, Any]) -> dict[str, Any]:
        if not session.persistent:
            raise Forbidden("Create an account to share interview reports.", code="report_account")
        reports.check(report, date.today())
        since = datetime.now(UTC) - timedelta(days=1)
        if self.reports.count_since(session.owner, since) >= reports.DAILY_LIMIT:
            raise QuotaExceeded("You can share up to five reports a day.", code="report_quota")
        key, name = self._key(session, company_id)
        saved = self.reports.add(session.owner, key, {**report, "company_name": name})
        return reports.public(saved, session.owner)

    def delete(self, session: Session, report_id: str) -> None:
        self.reports.delete(session.owner, report_id)

    def mine(self, session: Session) -> list[dict[str, Any]]:
        return [reports.public(r, session.owner) for r in self.reports.mine(session.owner)]

    def queue(self, session: Session) -> list[dict[str, Any]]:
        """Reports waiting for moderation. Moderators never see who wrote them."""
        self.auth.require_admin(session)
        return [reports.public(r) for r in self.reports.pending()]

    def moderate(self, session: Session, report_id: str, status: str, note: str) -> dict[str, Any]:
        self.auth.require_admin(session)
        return reports.public(self.reports.moderate(report_id, status, note))
