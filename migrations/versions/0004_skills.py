"""Shared, case-insensitive skill catalog and indexed fuzzy search."""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    table = op.create_table(
        "skills",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("normalized_name", sa.String(300), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.execute("CREATE INDEX ix_skills_trgm ON skills USING gin (normalized_name gin_trgm_ops)")
    seeds = [
        ("CSS", "Язык стилей для оформления и адаптивной вёрстки веб-страниц."),
        ("HTML", "Язык разметки для структуры и семантики веб-страниц."),
        ("JavaScript", "Язык программирования для интерактивных веб-приложений и серверов."),
        ("TypeScript", "JavaScript со статической типизацией для разработки приложений."),
        (
            "Python",
            "Язык программирования для серверной разработки, автоматизации и анализа данных.",
        ),
        ("PostgreSQL", "Реляционная база данных с SQL, транзакциями и расширяемыми типами."),
        ("React", "Библиотека для создания пользовательских интерфейсов из компонентов."),
        ("Docker", "Инструменты сборки и запуска приложений в контейнерах."),
    ]
    op.bulk_insert(
        table,
        [
            dict(
                id=str(uuid4()), name=name, normalized_name=name.casefold(), description=description
            )
            for name, description in seeds
        ],
    )


def downgrade():
    op.drop_table("skills")
