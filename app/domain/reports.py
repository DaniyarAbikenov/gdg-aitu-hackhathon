"""Anonymous interview reports shared between candidates after moderation."""

import re
from collections.abc import Mapping
from datetime import date
from typing import Any

from app.domain.errors import InvalidDocument

STATUSES = ("pending", "approved", "rejected")
OUTCOMES = ("offer", "rejected", "no_answer", "in_progress", "withdrew")
DAILY_LIMIT = 5
PRIVATE = re.compile(
    r"[\w.+-]+@[\w-]+\.[\w.]+"  # e-mail
    r"|https?://|www\."  # links
    r"|(?<!\w)@[A-Za-z0-9_]{3,}"  # social handles
    r"|(?:\+?\d[\s()-]*){9,}",  # phone numbers
)
TEXT_FIELDS = ("role", "stages", "advice")


def check(report: Mapping[str, Any], today: date) -> None:
    """Reject reports that could identify someone or that say nothing."""
    texts = [str(report.get(k, "")) for k in TEXT_FIELDS] + list(report.get("questions") or [])
    if any(PRIVATE.search(t) for t in texts):
        raise InvalidDocument(
            "Remove contact details and links: reports are anonymous.", code="report_private"
        )
    if not (report.get("stages") or report.get("questions") or report.get("advice")):
        raise InvalidDocument(
            "Describe the stages, the questions or your advice.", code="report_empty"
        )
    if str(report["interviewed_on"]) > today.strftime("%Y-%m"):
        raise InvalidDocument("The interview month cannot be in the future.", code="report_date")


def public(report: Mapping[str, Any], owner: str | None = None) -> dict[str, Any]:
    """What other candidates see: no author, and only the month of the report."""
    view = {
        k: report[k]
        for k in (
            "id",
            "company_name",
            "role",
            "interviewed_on",
            "stages",
            "questions",
            "difficulty",
            "outcome",
            "advice",
            "status",
        )
    }
    view["mine"] = owner is not None and report["owner"] == owner
    if view["mine"]:
        view["moderation_note"] = report.get("moderation_note", "")
    return view
