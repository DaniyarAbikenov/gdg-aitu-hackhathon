"""Cover letters are built only from facts the candidate confirmed in a profile or resume."""

from typing import Any

from app.domain.models import ResumeFields
from app.domain.review import compare

LETTER_LANGUAGES = ("en", "ru", "kk")


def vacancy_text(vacancy: dict[str, Any]) -> str:
    parts = [vacancy.get("name", ""), vacancy.get("description", "")]
    for key in ("requirements", "responsibilities", "skills"):
        parts += vacancy.get(key) or []
    return "\n".join(p for p in parts if p)


def entries(value: Any, *keys: str) -> list[dict[str, Any]]:
    """Structured resume sections; legacy free-text sections are passed as one entry."""
    if isinstance(value, list):
        return [{k: item.get(k) for k in keys if item.get(k)} for item in value]
    return [{"text": value}] if value else []


def candidate_facts(profile: dict[str, Any], resume: dict[str, Any] | None) -> dict[str, Any]:
    """The selected resume wins over the profile; nothing is inferred from the vacancy."""
    source = resume or profile
    return {
        "full_name": source.get("full_name") or profile.get("full_name", ""),
        "position": profile.get("desired_position") or source.get("position", ""),
        "summary": source.get("summary") or profile.get("summary", ""),
        "skills": list(source.get("skills") or profile.get("skills") or []),
        "experience": entries(
            source.get("experience"), "role", "company", "date_from", "date_to", "achievements"
        ),
        "projects": entries(source.get("projects"), "title", "description", "tech"),
        "education": entries(source.get("education"), "institution", "degree", "year_end"),
    }


def skill_match(facts: dict[str, Any], vacancy: dict[str, Any]) -> tuple[list[str], list[str]]:
    fields = ResumeFields(
        summary=facts["summary"],
        skills=facts["skills"],
        experience=facts["experience"],
        projects=facts["projects"],
    )
    result = compare(fields, vacancy_text(vacancy))
    return result.matched_skills, result.missing_skills
