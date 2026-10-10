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
    auth_version: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
    password_hash: Mapped[str | None] = mapped_column(String(512))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


def account_view(row: AccountRow) -> dict:
    return {
        "owner": row.owner,
        "email": row.email,
        "password_hash": row.password_hash,
        "auth_version": row.auth_version,
        "email_verified": row.email_verified_at is not None,
    }


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

    def apply_proposal(
        self,
        session,
        resume_id,
        revision,
        assessment_id,
        assessment_revision,
        fields,
        remaining,
        section,
    ):
        from app.infrastructure.activity import record_activity
        from app.infrastructure.postgres import to_record

        with self.sessions.begin() as db:
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:owner))"), {"owner": session.owner}
            )
            resume = db.scalar(
                select(ResumeRow)
                .where(ResumeRow.id == resume_id, *self.visible(ResumeRow, session.owner))
                .with_for_update()
            )
            assessment = db.scalar(
                select(AssessmentRow)
                .where(
                    AssessmentRow.id == assessment_id, *self.visible(AssessmentRow, session.owner)
                )
                .with_for_update()
            )
            if not resume or not assessment:
                raise NotFound
            if resume.revision != revision or assessment.revision != assessment_revision:
                raise Conflict
            count = db.scalar(
                select(func.count())
                .select_from(VersionRow)
                .where(*self.visible(VersionRow, session.owner))
            )
            if count + 2 > 100:
                raise QuotaExceeded
            now = datetime.now(UTC)
            for label, snapshot in [
                ("До изменения: " + section, resume.fields),
                ("Адаптация: " + section, fields),
            ]:
                version = VersionRow(
                    id=str(uuid4()),
                    owner=session.owner,
                    revision=1,
                    created_at=now,
                    expires_at=resume.expires_at,
                    data={
                        "resume_id": resume_id,
                        "fields": snapshot,
                        "before": resume.fields,
                        "label": label,
                        "jd_text": remaining["job"],
                    },
                )
                db.add(version)
                record_activity(db, session.owner, "version_created", version.id)
            resume.fields = fields
            resume.revision += 1
            resume.status = "edited"
            resume.analysis = None
            resume.jd_text = remaining["job"]
            resume.updated_at = now
            assessment.data = remaining
            assessment.revision += 1
            db.flush()
            return to_record(resume)

    def sync_resume(self, session, resume_id, revision, fields, link, label):
        """Saves profile changes into a resume, keeping the previous text as a version."""
        from app.infrastructure.activity import record_activity
        from app.infrastructure.postgres import to_record

        with self.sessions.begin() as db:
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:owner))"), {"owner": session.owner}
            )
            resume = db.scalar(
                select(ResumeRow)
                .where(ResumeRow.id == resume_id, *self.visible(ResumeRow, session.owner))
                .with_for_update()
            )
            if not resume:
                raise NotFound
            if resume.revision != revision:
                raise Conflict
            now = datetime.now(UTC)
            if fields != resume.fields:
                count = db.scalar(
                    select(func.count())
                    .select_from(VersionRow)
                    .where(*self.visible(VersionRow, session.owner))
                )
                if count + 1 > 100:
                    raise QuotaExceeded
                version = VersionRow(
                    id=str(uuid4()),
                    owner=session.owner,
                    revision=1,
                    created_at=now,
                    expires_at=resume.expires_at,
                    data={
                        "resume_id": resume_id,
                        "fields": resume.fields,
                        "before": resume.fields,
                        "label": label,
                        "jd_text": resume.jd_text,
                    },
                )
                db.add(version)
                record_activity(db, session.owner, "version_created", version.id)
                resume.fields = fields
                resume.status = "edited"
                resume.analysis = None
            resume.profile_link = link
            resume.revision += 1
            resume.updated_at = now
            db.flush()
            return to_record(resume)

    def delete(self, kind, owner, record_id):
        table = TABLES[kind]
        with self.sessions.begin() as db:
            if not db.execute(
                delete(table).where(table.id == record_id, *self.visible(table, owner))
            ).rowcount:
                raise NotFound

    def clear(self, owner):
        from app.infrastructure.activity import ActivityRow
        from app.infrastructure.interview_reports import InterviewReportRow

        with self.sessions.begin() as db:
            for row in (ActivityRow, InterviewReportRow):
                db.execute(delete(row).where(row.owner == owner))
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
            return account_view(row)

    def account_for_owner(self, owner):
        with self.sessions() as db:
            row = db.get(AccountRow, owner)
            if not row:
                raise NotFound
            return account_view(row)

    def verify_email(self, owner, email):
        with self.sessions.begin() as db:
            db.execute(
                update(AccountRow)
                .where(
                    AccountRow.owner == owner,
                    AccountRow.email == email,
                    AccountRow.email_verified_at.is_(None),
                )
                .values(email_verified_at=datetime.now(UTC))
            )

    def change_password(self, owner, auth_version, password_hash):
        with self.sessions.begin() as db:
            if not db.execute(
                update(AccountRow)
                .where(AccountRow.owner == owner, AccountRow.auth_version == auth_version)
                .values(password_hash=password_hash, auth_version=auth_version + 1)
            ).rowcount:
                raise Conflict

    def delete_account(self, owner, auth_version):
        from app.infrastructure.activity import ActivityRow
        from app.infrastructure.interview_reports import InterviewReportRow

        with self.sessions.begin() as db:
            account = db.scalar(
                select(AccountRow).where(AccountRow.owner == owner).with_for_update()
            )
            if account is None:
                raise NotFound
            if account.auth_version != auth_version:
                raise Conflict
            for table in [ResumeRow, ActivityRow, InterviewReportRow, *TABLES.values()]:
                db.execute(delete(table).where(table.owner == owner))
            db.delete(account)

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
                        owner=guest_owner,
                        email=email,
                        google_subject=subject,
                        password_hash=None,
                        email_verified_at=datetime.now(UTC),
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
