"""Durable account session revocation version."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "accounts", sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0")
    )


def downgrade():
    op.drop_column("accounts", "auth_version")
