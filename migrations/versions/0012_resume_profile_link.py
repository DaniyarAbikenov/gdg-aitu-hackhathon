"""Remember which profile facts each resume was built from."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("resumes", sa.Column("profile_link", postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column("resumes", "profile_link")
