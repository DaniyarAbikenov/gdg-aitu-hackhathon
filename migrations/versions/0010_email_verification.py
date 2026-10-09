"""Track when an account proved it owns its email address."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "accounts", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Google only issues tokens for addresses it has verified.
    op.execute("UPDATE accounts SET email_verified_at = now() WHERE google_subject IS NOT NULL")


def downgrade():
    op.drop_column("accounts", "email_verified_at")
