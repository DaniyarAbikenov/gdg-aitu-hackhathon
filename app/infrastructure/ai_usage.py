"""Durable AI usage log in PostgreSQL. Recording never fails the request it describes."""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Identity,
    Index,
    Integer,
    String,
    case,
    cast,
    delete,
    func,
    select,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Date

from app.application.ports import AiCall
from app.infrastructure.postgres import Base


class AiUsageRow(Base):
    __tablename__ = "ai_usage"
    __table_args__ = (Index("ix_ai_usage_created_at", "created_at"),)
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(120))
    operation: Mapped[str] = mapped_column(String(60))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int] = mapped_column(Integer)
    succeeded: Mapped[bool] = mapped_column(Boolean)


class PostgresAiUsage:
    def __init__(self, sessions):
        self.sessions = sessions

    def record(self, call: AiCall) -> None:
        try:
            with self.sessions.begin() as db:
                db.add(
                    AiUsageRow(
                        created_at=datetime.now(UTC),
                        provider=call.provider,
                        model=call.model[:120],
                        operation=call.operation[:60],
                        input_tokens=call.input_tokens,
                        output_tokens=call.output_tokens,
                        duration_ms=call.duration_ms,
                        succeeded=call.succeeded,
                    )
                )
        except SQLAlchemyError:
            logging.getLogger("career").warning("AI usage was not recorded", exc_info=True)

    def summary(self, since: datetime) -> dict[str, Any]:
        recent = AiUsageRow.created_at >= since
        failed = func.sum(case((AiUsageRow.succeeded.is_(False), 1), else_=0))
        tokens_in, tokens_out = (
            func.sum(AiUsageRow.input_tokens),
            func.sum(AiUsageRow.output_tokens),
        )
        with self.sessions() as db:
            operations = db.execute(
                select(
                    AiUsageRow.provider,
                    AiUsageRow.model,
                    AiUsageRow.operation,
                    func.count(),
                    failed,
                    tokens_in,
                    tokens_out,
                    func.avg(AiUsageRow.duration_ms),
                )
                .where(recent)
                .group_by(AiUsageRow.provider, AiUsageRow.model, AiUsageRow.operation)
                .order_by(tokens_in.desc())
            ).all()
            day = cast(func.timezone("UTC", AiUsageRow.created_at), Date)
            days = db.execute(
                select(day, func.count(), tokens_in, tokens_out)
                .where(recent)
                .group_by(day)
                .order_by(day)
            ).all()
        return {
            "operations": [
                {
                    "provider": provider,
                    "model": model,
                    "operation": operation,
                    "calls": calls,
                    "failed": int(failures or 0),
                    "input_tokens": int(sent or 0),
                    "output_tokens": int(received or 0),
                    "average_ms": round(float(average or 0)),
                }
                for provider, model, operation, calls, failures, sent, received, average in operations
            ],
            "daily": [
                {
                    "day": value.isoformat(),
                    "calls": calls,
                    "input_tokens": int(sent or 0),
                    "output_tokens": int(received or 0),
                }
                for value, calls, sent, received in days
            ],
        }

    def purge(self, before: datetime) -> int:
        with self.sessions.begin() as db:
            return db.execute(delete(AiUsageRow).where(AiUsageRow.created_at < before)).rowcount
