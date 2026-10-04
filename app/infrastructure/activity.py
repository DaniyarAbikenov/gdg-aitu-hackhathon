"""Durable idempotent activity log, written in the aggregate transaction."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Index, String, UniqueConstraint, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.postgres import Base


class ActivityRow(Base):
    __tablename__ = "career_activity"
    __table_args__ = (
        UniqueConstraint("owner", "kind", "source"),
        Index("ix_activity_owner_date", "owner", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36))
    kind: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def record_activity(db, owner, kind, source):
    db.execute(
        insert(ActivityRow)
        .values(
            id=str(uuid4()), owner=owner, kind=kind, source=source, created_at=datetime.now(UTC)
        )
        .on_conflict_do_nothing()
    )


class ActivityRepository:
    def __init__(self, sessions):
        self.sessions = sessions

    def list(self, owner):
        with self.sessions() as db:
            return [
                {"kind": r.kind, "source": r.source, "at": r.created_at.isoformat()}
                for r in db.scalars(
                    select(ActivityRow)
                    .where(ActivityRow.owner == owner)
                    .order_by(ActivityRow.created_at.desc())
                )
            ]
