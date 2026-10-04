"""Resume identity, saved targets, preferences, activity and knowledge articles."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    for name, typ, default in [
        ("title", sa.String(200), ""),
        ("description", sa.Text, ""),
        ("lifecycle", sa.String(20), "draft"),
    ]:
        op.add_column("resumes", sa.Column(name, typ, nullable=False, server_default=default))
        op.alter_column("resumes", name, server_default=None)
    op.add_column(
        "resumes",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.execute("UPDATE resumes SET title = filename, updated_at = created_at")
    op.alter_column("resumes", "updated_at", server_default=None)
    for name in ["career_preferences", "career_companies", "career_vacancies"]:
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner", sa.String(36), nullable=False),
            sa.Column("revision", sa.Integer, nullable=False),
            sa.Column("data", JSONB, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_" + name + "_owner", name, ["owner"])
        op.create_index("ix_" + name + "_expires_at", name, ["expires_at"])
    op.create_table(
        "career_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("source", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner", "kind", "source"),
    )
    op.create_index("ix_activity_owner_date", "career_activity", ["owner", "created_at"])
    op.create_table(
        "knowledge_articles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("published", sa.Boolean, nullable=False),
        sa.Column("revision", sa.Integer, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    for name in [
        "knowledge_articles",
        "career_activity",
        "career_preferences",
        "career_companies",
        "career_vacancies",
    ]:
        op.drop_table(name)
    for name in ["title", "description", "lifecycle", "updated_at"]:
        op.drop_column("resumes", name)
