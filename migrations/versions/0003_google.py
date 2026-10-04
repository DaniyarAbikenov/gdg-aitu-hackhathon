"""Support Google identities without implicit password-account linking."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("accounts", "password_hash", nullable=True)
    op.add_column("accounts", sa.Column("google_subject", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_accounts_google_subject", "accounts", ["google_subject"])


def downgrade():
    op.drop_constraint("uq_accounts_google_subject", "accounts", type_="unique")
    op.drop_column("accounts", "google_subject")
