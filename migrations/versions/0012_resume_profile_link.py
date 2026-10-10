"""Remember which profile facts each resume was built from.

Existing profile entries get stable ids so they can be chosen one by one.
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

SECTIONS = ("experience", "education", "projects")


def upgrade():
    op.add_column("resumes", sa.Column("profile_link", postgresql.JSONB(), nullable=True))
    db = op.get_bind()
    rows = db.execute(sa.text("SELECT id, data FROM career_profiles")).all()
    for row_id, data in rows:
        changed = False
        for section in SECTIONS:
            entries = data.get(section)
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if isinstance(entry, dict) and not entry.get("id"):
                    entry["id"] = uuid4().hex[:12]
                    changed = True
        if changed:
            db.execute(
                sa.text("UPDATE career_profiles SET data = CAST(:data AS jsonb) WHERE id = :id"),
                {"data": json.dumps(data), "id": row_id},
            )


def downgrade():
    op.drop_column("resumes", "profile_link")
