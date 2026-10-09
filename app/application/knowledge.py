"""Published knowledge articles; editing is limited to administrators."""

from typing import Any

from app.application.auth import Auth
from app.application.ports import KnowledgeStore
from app.domain.models import Session


class Knowledge:
    def __init__(self, store: KnowledgeStore, auth: Auth):
        self.store, self.auth = store, auth

    def published(self, query: str, language: str | None) -> list[dict[str, Any]]:
        return self.store.list(query, language=language)

    def all(self, session: Session) -> list[dict[str, Any]]:
        self.auth.require_admin(session)
        return self.store.list("", admin=True)

    def save(
        self,
        session: Session,
        article: dict[str, Any],
        article_id: str | None = None,
        revision: int = 0,
    ) -> dict[str, Any]:
        self.auth.require_admin(session)
        return self.store.save(article, article_id, revision)
