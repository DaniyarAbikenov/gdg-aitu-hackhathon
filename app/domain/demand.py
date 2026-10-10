"""How often skills appear in the vacancies a candidate saved."""

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from app.domain.letter import vacancy_text
from app.domain.review import skills_in
from app.domain.skills import skill_key, skill_name

ACTIVE = {"saved", "preparing", "applied", "interview"}


def vacancy_skills(vacancy: Mapping[str, Any]) -> list[str]:
    """Skills listed on the vacancy plus known skills named in its text, once each."""
    found: dict[str, str] = {}
    for name in [*(vacancy.get("skills") or []), *skills_in(vacancy_text(dict(vacancy)))]:
        name = skill_name(name)
        if name:
            found.setdefault(skill_key(name), name)
    return list(found.values())


def demand(vacancies: Iterable[Mapping[str, Any]]) -> tuple[Counter[str], dict[str, str]]:
    """Per skill key: the number of open vacancies that ask for it, and a display name."""
    counts: Counter[str] = Counter()
    names: dict[str, str] = {}
    for vacancy in vacancies:
        if vacancy.get("status", "saved") not in ACTIVE:
            continue
        for name in vacancy_skills(vacancy):
            counts[skill_key(name)] += 1
            names.setdefault(skill_key(name), name)
    return counts, names
