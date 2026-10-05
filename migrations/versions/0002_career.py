"""Restore career profiles, interview sessions, learning plans, versions and accounts."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("resumes", "expires_at", nullable=True)
    op.create_table(
        "accounts",
        sa.Column("owner", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(512), nullable=False),
    )
    for name in [
        "career_profiles",
        "career_interviews",
        "career_plans",
        "resume_versions",
        "career_rewards",
    ]:
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner", sa.String(36), nullable=False),
            sa.Column("revision", sa.Integer(), nullable=False),
            sa.Column("data", postgresql.JSONB(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(f"ix_{name}_owner", name, ["owner"])
        op.create_index(f"ix_{name}_expires_at", name, ["expires_at"])


def downgrade():
    for name in [
        "career_rewards",
        "resume_versions",
        "career_plans",
        "career_interviews",
        "career_profiles",
    ]:
        op.drop_table(name)
    op.drop_table("accounts")
    # Retain nullable expiration so account-owned records are not silently deleted.
