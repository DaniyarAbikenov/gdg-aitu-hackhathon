"""A company summary built only from the company's own website, every fact with its quote.

Whatever produced the facts (an AI provider or the rule-based extract), a fact is kept
only when its quote really appears on the page it cites.
"""

import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Any
from urllib.parse import urlsplit

from app.domain.review import skills_in

TOPICS = ("product", "stack", "hiring", "culture", "locations", "size", "other")
MAX_FACTS = 12
MAX_PAGES = 3
# Paths worth reading next to the home page, in order of preference.
USEFUL_PATHS = re.compile(
    r"about|company|careers?|jobs|vacanc|team|culture|values|"
    r"o-nas|o-kompanii|kompaniya|karera|vakansii|biz-turaly",
    re.IGNORECASE,
)
KEYWORDS = {
    "hiring": ("career", "vacanc", "hiring", "join us", "join our", "ваканс", "карьер"),
    "culture": ("value", "culture", "mission", "ценност", "культур", "мисси"),
    "locations": ("office", "offices", "headquarter", "офис"),
}


def normalized(text: str) -> str:
    return " ".join(text.casefold().split())


def useful_links(home: str, links: Iterable[str]) -> list[str]:
    """Same-site pages that probably describe the company or its hiring."""
    host = urlsplit(home).hostname
    seen: list[str] = []
    for link in links:
        parts = urlsplit(link)
        clean = parts._replace(query="", fragment="").geturl().rstrip("/")
        if (
            parts.scheme in {"http", "https"}
            and parts.hostname == host
            and USEFUL_PATHS.search(parts.path)
            and clean != home.rstrip("/")
            and clean not in seen
        ):
            seen.append(clean)
    return seen[: MAX_PAGES - 1]


def verify(
    facts: Iterable[Mapping[str, Any]], pages: Sequence[Mapping[str, str]]
) -> tuple[list[dict[str, str]], int]:
    """Keep facts whose quote is on the cited page; return them and how many were dropped."""
    texts = {page["url"]: normalized(page["text"]) for page in pages}
    kept: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    dropped = 0
    for fact in facts:
        quote = normalized(str(fact.get("quote", "")))
        text = " ".join(str(fact.get("text", "")).split())
        source = str(fact.get("source_url", ""))
        topic = fact.get("topic") if fact.get("topic") in TOPICS else "other"
        identity = (str(topic), text.casefold())
        if (
            not text
            or len(text) > 400
            or not 12 <= len(quote) <= 300
            or quote not in texts.get(source, "")
            or identity in seen
            or len(kept) >= MAX_FACTS
        ):
            dropped += 1
            continue
        seen.add(identity)
        kept.append(
            {
                "topic": str(topic),
                "text": text,
                "source_url": source,
                "quote": " ".join(str(fact["quote"]).split()),
            }
        )
    return kept, dropped


def stack(pages: Sequence[Mapping[str, str]]) -> list[dict[str, str]]:
    """Known technologies named on the site, each with the first page that names it."""
    found: dict[str, str] = {}
    for page in pages:
        for skill in skills_in(page["text"]):
            found.setdefault(skill, page["url"])
    return [{"name": name, "source_url": url} for name, url in found.items()]


def rule_based(pages: Sequence[Mapping[str, str]]) -> list[dict[str, str]]:
    """Sentences quoted as they are. It does not interpret or summarise."""
    facts = []
    for index, page in enumerate(pages):
        lines = [
            line.strip()
            for line in page["text"].splitlines()
            if 40 <= len(line.strip()) <= 300 and len(line.split()) >= 6
        ]
        for line in lines[:3]:
            folded = line.casefold()
            topic = next(
                (t for t, words in KEYWORDS.items() if any(w in folded for w in words)),
                "product" if index == 0 else "other",
            )
            facts.append({"topic": topic, "text": line, "source_url": page["url"], "quote": line})
    return facts
