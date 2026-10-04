from dataclasses import asdict
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    delete,
    func,
    or_,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.domain.errors import Conflict, NotFound, QuotaExceeded
from app.domain.models import Analysis, ResumeFields, ResumeRecord, Suggestion


class Base(DeclarativeBase):
    pass


class ResumeRow(Base):
    __tablename__ = "resumes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(36), index=True)
    filename: Mapped[str] = mapped_column(String(180))
    fields: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20))
    revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    jd_text: Mapped[str] = mapped_column(Text, default="")


def to_record(row):
    analysis = None
    if row.analysis:
        data = dict(row.analysis)
        data["suggestions"] = [Suggestion(**s) for s in data["suggestions"]]
        analysis = Analysis(**data)
    return ResumeRecord(
        resume_id=row.id,
        filename=row.filename,
        fields=ResumeFields(**row.fields),
        status=row.status,
        revision=row.revision,
        created_at=row.created_at.isoformat(),
        analysis=analysis,
        jd_text=row.jd_text,
    )


class PostgresRepository:
    def __init__(self, url):
        self.engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def health(self):
        with self.sessions() as db:
            db.execute(select(ResumeRow.id).limit(1))

    def close(self):
        self.engine.dispose()

    @staticmethod
    def visible(owner, resume_id=None):
        filters = [
            ResumeRow.owner == owner,
            or_(ResumeRow.expires_at.is_(None), ResumeRow.expires_at > datetime.now(UTC)),
        ]
        if resume_id is not None:
            filters.append(ResumeRow.id == resume_id)
        return filters

    def create(self, session, filename, fields):
        with self.sessions.begin() as db:
            # Serialize the quota check across workers without blocking other owners.
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:owner))"), {"owner": session.owner}
            )
            count = db.scalar(
                select(func.count())
                .select_from(ResumeRow)
                .where(
                    *self.visible(session.owner),
                )
            )
            if count >= 20:
                raise QuotaExceeded
            row = ResumeRow(
                id=str(uuid4()),
                owner=session.owner,
                filename=filename,
                fields=asdict(fields),
                status="extracted",
                revision=1,
                created_at=datetime.now(UTC),
                expires_at=None if session.persistent else session.expires_at,
                analysis=None,
                jd_text="",
            )
            db.add(row)
            db.flush()
            return to_record(row)

    def get(self, owner, resume_id):
        with self.sessions() as db:
            row = db.scalar(select(ResumeRow).where(*self.visible(owner, resume_id)))
            if row is None:
                raise NotFound
            return to_record(row)

    def list(self, owner):
        with self.sessions() as db:
            rows = db.scalars(
                select(ResumeRow)
                .where(*self.visible(owner))
                .order_by(
                    ResumeRow.created_at.desc(),
                )
            )
            return [to_record(row) for row in rows]

    def _update(self, owner, resume_id, revision, **values):
        with self.sessions.begin() as db:
            row = db.scalar(
                update(ResumeRow)
                .where(
                    *self.visible(owner, resume_id),
                    ResumeRow.revision == revision,
                )
                .values(revision=revision + 1, **values)
                .returning(ResumeRow)
            )
            if row is None:
                exists = db.scalar(select(ResumeRow.id).where(*self.visible(owner, resume_id)))
                if exists:
                    raise Conflict
                raise NotFound
            return to_record(row)

    def save(self, owner, resume_id, revision, fields):
        return self._update(
            owner,
            resume_id,
            revision,
            fields=asdict(fields),
            analysis=None,
            jd_text="",
            status="edited",
        )

    def review(self, owner, resume_id, revision, analysis, jd_text):
        return self._update(
            owner,
            resume_id,
            revision,
            analysis=asdict(analysis),
            jd_text=jd_text,
            status="reviewed",
        )

    def delete(self, owner, resume_id):
        from app.infrastructure.career_store import VersionRow

        with self.sessions.begin() as db:
            if not db.execute(delete(ResumeRow).where(*self.visible(owner, resume_id))).rowcount:
                raise NotFound
            db.execute(
                delete(VersionRow).where(
                    VersionRow.owner == owner, VersionRow.data["resume_id"].astext == resume_id
                )
            )

    def delete_owner(self, owner):
        with self.sessions.begin() as db:
            db.execute(delete(ResumeRow).where(ResumeRow.owner == owner))

    def purge_expired(self, now):
        with self.sessions.begin() as db:
            return db.execute(delete(ResumeRow).where(ResumeRow.expires_at <= now)).rowcount
