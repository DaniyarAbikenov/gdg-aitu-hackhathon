"""Owner-scoped PostgreSQL aggregates; one table per aggregate type."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, delete, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.career import CareerRecord
from app.domain.errors import Conflict, NotFound, QuotaExceeded
from app.infrastructure.postgres import Base, ResumeRow


class AggregateColumns:
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class ProfileRow(AggregateColumns, Base):
    __tablename__ = "career_profiles"


class InterviewRow(AggregateColumns, Base):
    __tablename__ = "career_interviews"


class PlanRow(AggregateColumns, Base):
    __tablename__ = "career_plans"


class VersionRow(AggregateColumns, Base):
    __tablename__ = "resume_versions"


class RewardRow(AggregateColumns, Base):
    __tablename__ = "career_rewards"


class AssessmentRow(AggregateColumns, Base):
    __tablename__ = "career_assessments"


class PreferencesRow(AggregateColumns, Base):
    __tablename__ = "career_preferences"


class CompanyRow(AggregateColumns, Base):
    __tablename__ = "career_companies"


class VacancyRow(AggregateColumns, Base):
    __tablename__ = "career_vacancies"


class AccountRow(Base):
    __tablename__ = "accounts"
    owner: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(512))


TABLES = {
    "assessment": AssessmentRow,
    "profile": ProfileRow,
    "preferences": PreferencesRow,
    "company": CompanyRow,
    "vacancy": VacancyRow,
    "interview": InterviewRow,
    "plan": PlanRow,
    "version": VersionRow,
    "reward": RewardRow,
}


def record(row):
    return CareerRecord(row.id, row.revision, row.data, row.created_at.isoformat())


class PostgresCareerRepository:
    def __init__(self, repository):
        self.sessions = repository.sessions

    def visible(self, table, owner):
        return (
            table.owner == owner,
            or_(table.expires_at.is_(None), table.expires_at > datetime.now(UTC)),
        )

    def create(self, kind, session, data, record_id=None):
        table = TABLES[kind]
        try:
            with self.sessions.begin() as db:
                db.execute(
                    text("SELECT pg_advisory_xact_lock(hashtext(:owner))"), {"owner": session.owner}
                )
                count = db.scalar(
                    select(func.count())
                    .select_from(table)
                    .where(*self.visible(table, session.owner))
                )
                if count >= 100:
                    raise QuotaExceeded
                row = table(
                    id=record_id or str(uuid4()),
                    owner=session.owner,
                    revision=1,
                    data=data,
                    created_at=datetime.now(UTC),
                    expires_at=None if session.persistent else session.expires_at,
                )
                db.add(row)
                db.flush()
                from app.infrastructure.activity import record_activity

                if kind == "assessment":
                    record_activity(db, session.owner, "resume_reviewed", data["resume_id"])
                if kind in {"version", "plan", "interview"}:
                    record_activity(db, session.owner, kind + "_created", row.id)
                return record(row)
        except IntegrityError as exc:
            raise Conflict from exc

    def get(self, kind, owner, record_id):
        table = TABLES[kind]
        with self.sessions() as db:
            row = db.scalar(select(table).where(table.id == record_id, *self.visible(table, owner)))
            if row is None:
                raise NotFound
            return record(row)

    def list(self, kind, owner):
        table = TABLES[kind]
        with self.sessions() as db:
            return [
                record(row)
                for row in db.scalars(
                    select(table)
                    .where(*self.visible(table, owner))
                    .order_by(table.created_at.desc())
                )
            ]

    def update(self, kind, owner, record_id, revision, data):
        table = TABLES[kind]
        with self.sessions.begin() as db:
            row = db.scalar(
                update(table)
                .where(
                    table.id == record_id, table.revision == revision, *self.visible(table, owner)
                )
                .values(data=data, revision=revision + 1)
                .returning(table)
            )
            if row is None:
                self.get(kind, owner, record_id)
                raise Conflict
            from app.infrastructure.activity import record_activity

            if kind == "plan":
                for module in data.get("modules", []):
                    if module.get("completed"):
                        record_activity(
                            db, owner, "module_completed", record_id + ":" + module["id"]
                        )
            if kind == "interview" and data.get("finished"):
                record_activity(db, owner, "interview_completed", record_id)
            return record(row)

    def delete(self, kind, owner, record_id):
        table = TABLES[kind]
        with self.sessions.begin() as db:
            if not db.execute(
                delete(table).where(table.id == record_id, *self.visible(table, owner))
            ).rowcount:
                raise NotFound

    def clear(self, owner):
        from app.infrastructure.activity import ActivityRow

        with self.sessions.begin() as db:
            db.execute(delete(ActivityRow).where(ActivityRow.owner == owner))
            for table in TABLES.values():
                db.execute(delete(table).where(table.owner == owner))

    def purge_expired(self, now):
        with self.sessions.begin() as db:
            for table in TABLES.values():
                db.execute(delete(table).where(table.expires_at <= now))

    def register(self, email, password_hash, owner):
        try:
            with self.sessions.begin() as db:
                db.add(AccountRow(email=email, password_hash=password_hash, owner=owner))
                db.flush()
                for table in [ResumeRow, *TABLES.values()]:
                    db.execute(update(table).where(table.owner == owner).values(expires_at=None))
        except IntegrityError as exc:
            raise Conflict from exc

    def email_for_owner(self, owner):
        with self.sessions() as db:
            return db.scalar(select(AccountRow.email).where(AccountRow.owner == owner)) or ""

    def account(self, email):
        with self.sessions() as db:
            row = db.scalar(select(AccountRow).where(AccountRow.email == email))
            if not row:
                raise NotFound
            return {"owner": row.owner, "email": row.email, "password_hash": row.password_hash}

    def promote(self, owner):
        with self.sessions.begin() as db:
            for table in [ResumeRow, *TABLES.values()]:
                db.execute(update(table).where(table.owner == owner).values(expires_at=None))

    def google_account(self, subject, email, guest_owner):
        try:
            with self.sessions.begin() as db:
                existing = db.scalar(select(AccountRow).where(AccountRow.google_subject == subject))
                if existing:
                    return existing.owner
                # Never silently link an existing password account by email.
                db.add(
                    AccountRow(
                        owner=guest_owner, email=email, google_subject=subject, password_hash=None
                    )
                )
                db.flush()
                for table in [ResumeRow, *TABLES.values()]:
                    db.execute(
                        update(table).where(table.owner == guest_owner).values(expires_at=None)
                    )
                return guest_owner
        except IntegrityError as exc:
            raise Conflict from exc
