"""Company website research and anonymous interview reports."""

from dataclasses import asdict
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Response
from pydantic import Field, field_validator

from app.presentation.dependencies import Cases, Member, RespondAsync
from app.presentation.jobs import ACCEPTED, accepted
from app.presentation.responses import InterviewReport, ResearchedCompany
from app.presentation.schemas import StrictModel


class ResearchRequest(StrictModel):
    revision: int = Field(ge=1)
    language: Literal["ru", "en", "kk"] = "ru"


class ReportForm(StrictModel):
    role: str = Field(min_length=2, max_length=200)
    interviewed_on: str = Field(pattern=r"^20\d\d-(0[1-9]|1[0-2])$")
    stages: str = Field(default="", max_length=3000)
    questions: list[str] = Field(default_factory=list, max_length=15)
    difficulty: int = Field(ge=1, le=5)
    outcome: Literal["offer", "rejected", "no_answer", "in_progress", "withdrew"]
    advice: str = Field(default="", max_length=3000)

    @field_validator("questions")
    @classmethod
    def clean_questions(cls, value: list[str]) -> list[str]:
        cleaned = [q.strip() for q in value if q.strip()]
        if any(len(q) > 500 for q in cleaned):
            raise ValueError("Keep each question under 500 characters")
        return cleaned


class Moderation(StrictModel):
    status: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=500)


def insights_router() -> APIRouter:
    routes = APIRouter(tags=["companies"])

    @routes.post(
        "/companies/{company_id}/research", response_model=ResearchedCompany, responses=ACCEPTED
    )
    def research(
        company_id: UUID,
        payload: ResearchRequest,
        cases: Cases,
        current: Member,
        later: RespondAsync,
    ):
        arguments: dict[str, Any] = {
            "company_id": str(company_id),
            "revision": payload.revision,
            "language": payload.language,
        }
        if later:
            return accepted(cases.jobs.submit(current, "company.research", **arguments))
        record = cases.company_insights.research(current, **arguments)
        return {**asdict(record), "research": record.data["research"]}

    @routes.get("/companies/{company_id}/reports", response_model=list[InterviewReport])
    def company_reports(company_id: UUID, cases: Cases, current: Member):
        return cases.company_insights.company_reports(current, str(company_id))

    @routes.post("/companies/{company_id}/reports", response_model=InterviewReport, status_code=201)
    def share_report(company_id: UUID, payload: ReportForm, cases: Cases, current: Member):
        return cases.company_insights.share(current, str(company_id), payload.model_dump())

    @routes.get("/reports", response_model=list[InterviewReport])
    def my_reports(cases: Cases, current: Member):
        return cases.company_insights.mine(current)

    @routes.delete("/reports/{report_id}", status_code=204)
    def delete_report(report_id: UUID, cases: Cases, current: Member):
        cases.company_insights.delete(current, str(report_id))
        return Response(status_code=204)

    @routes.get("/admin/reports", response_model=list[InterviewReport])
    def moderation_queue(cases: Cases, current: Member):
        return cases.company_insights.queue(current)

    @routes.post("/admin/reports/{report_id}", response_model=InterviewReport)
    def moderate(report_id: UUID, payload: Moderation, cases: Cases, current: Member):
        return cases.company_insights.moderate(
            current, str(report_id), payload.status, payload.note
        )

    return routes
