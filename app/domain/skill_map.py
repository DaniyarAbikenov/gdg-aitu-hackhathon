"""Skill map: what the candidate has, what saved vacancies ask for, what they study and practise.

Practice scores are attributed to the skills a question names; a question that names none
counts for the stack of its practice session. The result says which rule was used.
"""

import re
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping
from itertools import combinations
from typing import Any

from app.domain.demand import ACTIVE, vacancy_skills
from app.domain.review import skills_in
from app.domain.skills import skill_key, skill_name

MAX_NODES = 40
STACK_SEPARATORS = re.compile(r"[,;\n/|]+")


def split_stack(text: str) -> list[str]:
    """Names in a free-text stack such as "Python, FastAPI / PostgreSQL"."""
    found: dict[str, str] = {}
    for part in STACK_SEPARATORS.split(text or ""):
        name = skill_name(part)
        if not any(c.isalnum() for c in name):
            continue
        # A short part is a skill name ("Spring Boot"); in a sentence only known skills count.
        short = len(name) <= 40 and len(name.split()) <= 3
        for skill in [name] if short else skills_in(name):
            found.setdefault(skill_key(skill), skill)
    return list(found.values())


def mentioned(text: str, names: Mapping[str, str]) -> set[str]:
    """Keys of the known skills a text names, by whole word or a known alias."""
    folded = text.casefold()
    keys = {skill_key(s) for s in skills_in(text)} & set(names)
    for key in names:
        # One-letter names (C, R) would match inside unrelated words and C++.
        if len(key) > 1 and re.search(r"(?<![\w+#])" + re.escape(key) + r"(?![\w+#])", folded):
            keys.add(key)
    return keys


def _status(in_profile: bool, demand: int, learning: bool) -> str:
    if in_profile:
        return "strength" if demand else "have"
    if demand and not learning:
        return "gap"
    return "learning"


def build(
    profile_skills: Iterable[str],
    vacancies: Iterable[tuple[str, Mapping[str, Any]]],
    plans: Iterable[tuple[str, Mapping[str, Any]]],
    interviews: Iterable[tuple[str, str, Mapping[str, Any]]],
) -> dict[str, Any]:
    names: dict[str, str] = {}

    def known(name: str) -> str:
        key = skill_key(name)
        names.setdefault(key, skill_name(name))
        return key

    have = {known(s) for s in profile_skills if skill_name(s)}

    open_vacancies = [(i, v) for i, v in vacancies if v.get("status", "saved") in ACTIVE]
    asked: dict[str, list[dict[str, str]]] = defaultdict(list)
    links: Counter[tuple[str, str]] = Counter()
    for vacancy_id, vacancy in open_vacancies:
        listed = sorted({known(s) for s in vacancy_skills(vacancy)})
        for key in listed:
            asked[key].append(
                {
                    "id": vacancy_id,
                    "name": str(vacancy.get("name", "")),
                    "company": str(vacancy.get("company_name", "")),
                }
            )
        links.update(combinations(listed, 2))

    plans = list(plans)
    interviews = [(i, at, d) for i, at, d in interviews if d.get("finished")]
    stacks = {
        i: [known(s) for s in split_stack(d["context"].get("tech_stack", ""))]
        for i, _, d in interviews
    }
    for _, plan in plans:
        for stack in plan.get("stacks") or []:
            if skill_name(stack):
                known(stack)

    learning: dict[str, dict[str, Any]] = {}
    for plan_id, plan in plans:
        modules = plan.get("modules") or []
        studied = {skill_key(s) for s in plan.get("stacks") or [] if skill_name(s)}
        for module in modules:
            studied |= mentioned(
                f"{module.get('title', '')} {module.get('resource_topic', '')}", names
            )
        done = sum(bool(m.get("completed")) for m in modules)
        for key in studied:
            entry = learning.setdefault(key, {"plans": [], "completed": 0, "total": 0})
            entry["plans"].append(plan_id)
            entry["completed"] += done
            entry["total"] += len(modules)

    practice: dict[str, list[dict[str, Any]]] = defaultdict(list)
    scores = []
    for interview_id, at, data in sorted(interviews, key=lambda item: item[1]):
        context = data["context"]
        scores.append(
            {
                "interview_id": interview_id,
                "at": at,
                "score": data.get("score"),
                "label": context.get("vacancy_title") or context.get("company_name") or "",
            }
        )
        per_skill: dict[str, list[int]] = defaultdict(list)
        for answer in data.get("answers") or []:
            if not isinstance(answer.get("score"), int):
                continue
            named = mentioned(answer.get("question", ""), names) or set(stacks[interview_id])
            for key in named:
                per_skill[key].append(answer["score"])
        for key, values in per_skill.items():
            practice[key].append(
                {
                    "interview_id": interview_id,
                    "at": at,
                    "score": round(sum(values) / len(values)),
                    "answers": len(values),
                }
            )

    nodes: list[dict[str, Any]] = []
    for key, name in names.items():
        demand = len(asked.get(key, []))
        history = practice.get(key, [])
        study = learning.get(key)
        nodes.append(
            {
                "key": key,
                "name": name,
                "status": _status(key in have, demand, study is not None),
                "in_profile": key in have,
                "demand": demand,
                "vacancies": asked.get(key, []),
                "learning": study,
                "practice": history,
            }
        )
    nodes.sort(
        key=lambda n: (
            -(
                3 * n["demand"]
                + 2 * n["in_profile"]
                + 2 * bool(n["learning"])
                + bool(n["practice"])
            ),
            n["name"].casefold(),
        )
    )
    nodes = nodes[:MAX_NODES]
    kept = {n["key"] for n in nodes}
    strengths = [n for n in nodes if n["status"] == "strength"]
    gaps = [n for n in nodes if n["status"] == "gap"]
    return {
        "vacancies": len(open_vacancies),
        "nodes": nodes,
        "links": [
            {"source": a, "target": b, "weight": w}
            for (a, b), w in sorted(links.items())
            if a in kept and b in kept
        ],
        "scores": scores,
        "strongest": max(strengths, key=lambda n: n["demand"])["key"] if strengths else None,
        # Nodes are already ordered by demand first, so the first gaps are the most requested.
        "next_to_learn": [n["key"] for n in gaps[:3]],
    }
