from uuid import uuid4

from sqlalchemy import Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.postgres import Base


class SkillRow(Base):
    __tablename__ = "skills"
    __table_args__ = (
        Index(
            "ix_skills_trgm",
            "normalized_name",
            postgresql_using="gin",
            postgresql_ops={"normalized_name": "gin_trgm_ops"},
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    normalized_name: Mapped[str] = mapped_column(String(300), unique=True)
    description: Mapped[str] = mapped_column(Text)


class PostgresSkillRepository:
    def __init__(self, engine):
        self.engine = engine

    def search(self, key):
        # PostgreSQL trigram index provides typo candidates without scanning in Python.
        with self.engine.connect() as db:
            if not key:
                rows = db.execute(
                    text(
                        "SELECT id, name, description FROM skills ORDER BY normalized_name LIMIT 15"
                    )
                )
            else:
                escaped = key.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                rows = db.execute(
                    text("""
                    SELECT id, name, description FROM skills
                    WHERE normalized_name = :key OR normalized_name ILIKE :prefix
                       OR normalized_name % :key
                    ORDER BY (normalized_name = :key) DESC,
                             similarity(normalized_name, :key) DESC, normalized_name
                    LIMIT 15
                """),
                    {"key": key, "prefix": escaped + "%"},
                )
            return [dict(row) for row in rows.mappings()]

    def add(self, name, key, description):
        with self.engine.begin() as db:
            # Unique constraint also serializes concurrent CSS/css submissions.
            row = (
                db.execute(
                    text("""
                INSERT INTO skills (id, name, normalized_name, description)
                VALUES (:id, :name, :key, :description)
                ON CONFLICT (normalized_name) DO UPDATE SET normalized_name = EXCLUDED.normalized_name
                RETURNING id, name, description
            """),
                    {"id": str(uuid4()), "name": name, "key": key, "description": description},
                )
                .mappings()
                .one()
            )
            return dict(row)
