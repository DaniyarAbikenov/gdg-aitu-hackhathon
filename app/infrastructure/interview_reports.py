"""Anonymous interview reports in PostgreSQL, shared across accounts after moderation."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, SmallInteger, String, Text, delete, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.errors import NotFound
from app.infrastructure.postgres import Base


class InterviewReportRow(Base):
    __tablename__ = "interview_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36), index=True)
    company_key: Mapped[str] = mapped_column(String(200), index=True)
    company_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(200))
    interviewed_on: Mapped[str] = mapped_column(String(7))
    stages: Mapped[str] = mapped_column(Text)
    questions: Mapped[list] = mapped_column(JSONB)
    difficulty: Mapped[int] = mapped_column(SmallInteger)
    outcome: Mapped[str] = mapped_column(String(20))
    advice: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), index=True)
    moderation_note: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


FIELDS = ("role", "interviewed_on", "stages", "questions", "difficulty", "outcome", "advice")


def _dict(row: InterviewReportRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "owner": row.owner,
        "company_key": row.company_key,
        "company_name": row.company_name,
        **{k: getattr(row, k) for k in FIELDS},
        "status": row.status,
        "moderation_note": row.moderation_note,
        "created_at": row.created_at.isoformat(),
    }


class InterviewReportRepository:
    def __init__(self, sessions):
        self.sessions = sessions

    def add(self, owner: str, company_key: str, report: dict[str, Any]) -> dict[str, Any]:
        row = InterviewReportRow(
            id=str(uuid4()),
            owner=owner,
            company_key=company_key[:200],
            company_name=str(report["company_name"])[:200],
            **{k: report.get(k, "" if k != "questions" else []) for k in FIELDS},
            status="pending",
            moderation_note="",
            created_at=datetime.now(UTC),
            moderated_at=None,
        )
        with self.sessions.begin() as db:
            db.add(row)
            db.flush()
            return _dict(row)

    def count_since(self, owner: str, since: datetime) -> int:
        with self.sessions() as db:
            return db.scalar(
                select(func.count())
                .select_from(InterviewReportRow)
                .where(InterviewReportRow.owner == owner, InterviewReportRow.created_at >= since)
            )

    def _list(self, *where) -> list[dict[str, Any]]:
        with self.sessions() as db:
            rows = db.scalars(
                select(InterviewReportRow)
                .where(*where)
                .order_by(
                    InterviewReportRow.interviewed_on.desc(), InterviewReportRow.created_at.desc()
                )
                .limit(200)
            )
            return [_dict(row) for row in rows]

    def for_company(self, company_key: str, owner: str) -> list[dict[str, Any]]:
        return self._list(
            InterviewReportRow.company_key == company_key,
            or_(InterviewReportRow.status == "approved", InterviewReportRow.owner == owner),
        )

    def mine(self, owner: str) -> list[dict[str, Any]]:
        return self._list(InterviewReportRow.owner == owner)

    def pending(self) -> list[dict[str, Any]]:
        with self.sessions() as db:
            rows = db.scalars(
                select(InterviewReportRow)
                .where(InterviewReportRow.status == "pending")
                .order_by(InterviewReportRow.created_at)
                .limit(100)
            )
            return [_dict(row) for row in rows]

    def moderate(self, report_id: str, status: str, note: str) -> dict[str, Any]:
        with self.sessions.begin() as db:
            row = db.get(InterviewReportRow, report_id, with_for_update=True)
            if row is None:
                raise NotFound
            row.status, row.moderation_note = status, note[:500]
            row.moderated_at = datetime.now(UTC)
            db.flush()
            return _dict(row)

    def delete(self, owner: str, report_id: str) -> None:
        with self.sessions.begin() as db:
            deleted = db.execute(
                delete(InterviewReportRow).where(
                    InterviewReportRow.id == report_id, InterviewReportRow.owner == owner
                )
            )
            if not deleted.rowcount:
                raise NotFound
