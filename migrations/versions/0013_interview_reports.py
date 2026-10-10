"""Anonymous interview reports that candidates share after moderation."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interview_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), nullable=False),
        sa.Column("company_key", sa.String(200), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(200), nullable=False),
        sa.Column("interviewed_on", sa.String(7), nullable=False),
        sa.Column("stages", sa.Text(), nullable=False),
        sa.Column("questions", postgresql.JSONB(), nullable=False),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("advice", sa.Text(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("moderation_note", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("owner", "company_key", "status"):
        op.create_index(f"ix_interview_reports_{column}", "interview_reports", [column])


def downgrade():
    op.drop_table("interview_reports")
