from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, String, Text, or_, select, update
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.errors import Conflict, NotFound
from app.infrastructure.postgres import Base


class ArticleRow(Base):
    __tablename__ = "knowledge_articles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(Boolean)
    revision: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def article(row):
    return {
        k: getattr(row, k)
        for k in ["id", "title", "category", "body", "published", "revision", "updated_at"]
    }


class KnowledgeRepository:
    def __init__(self, sessions):
        self.sessions = sessions

    def list(self, query, admin=False):
        with self.sessions() as db:
            q = query.replace("%", "\\%").replace("_", "\\_")
            statement = select(ArticleRow).where(
                or_(
                    ArticleRow.title.ilike(f"%{q}%"),
                    ArticleRow.body.ilike(f"%{q}%"),
                    ArticleRow.category.ilike(f"%{q}%"),
                )
            )
            if not admin:
                statement = statement.where(ArticleRow.published.is_(True))
            return [
                article(r)
                for r in db.scalars(statement.order_by(ArticleRow.updated_at.desc()).limit(100))
            ]

    def save(self, data, id=None, revision=0):
        with self.sessions.begin() as db:
            if id:
                row = db.scalar(
                    update(ArticleRow)
                    .where(ArticleRow.id == id, ArticleRow.revision == revision)
                    .values(**data, revision=revision + 1, updated_at=datetime.now(UTC))
                    .returning(ArticleRow)
                )
                if row is None:
                    if db.get(ArticleRow, id) is None:
                        raise NotFound
                    raise Conflict
            else:
                row = ArticleRow(id=str(uuid4()), **data, revision=1, updated_at=datetime.now(UTC))
                db.add(row)
                db.flush()
            return article(row)
