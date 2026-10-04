"""Create the resume aggregate with owner isolation and optimistic concurrency."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "resumes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), nullable=False),
        sa.Column("filename", sa.String(180), nullable=False),
        sa.Column("fields", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("analysis", postgresql.JSONB(), nullable=True),
        sa.Column("jd_text", sa.Text(), nullable=False),
        sa.CheckConstraint("revision >= 1", name="positive_revision"),
        sa.CheckConstraint("status IN ('extracted', 'edited', 'reviewed')", name="resume_status"),
    )
    op.create_index("ix_resumes_owner", "resumes", ["owner"])
    op.create_index("ix_resumes_expires_at", "resumes", ["expires_at"])


def downgrade():
    op.drop_table("resumes")
