"""Application funnel, rejection reviews and effort-based feedback.

Everything here is computed from what the candidate recorded. There are no hiring odds:
feedback describes effort and patterns, never the chance of an offer.
"""

from collections import Counter
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta
from typing import Any

STAGES = ("saved", "preparing", "applied", "interview", "offer")
FUNNEL = ("saved", "applied", "interview", "offer")
ACTIVE = {"saved", "preparing", "applied", "interview"}
REJECTION_STAGES = ("applied", "interview")
REASONS = (
    "no_reply",
    "screening",
    "technical",
    "assignment",
    "behavioral",
    "position_closed",
    "salary",
    "other_candidate",
    "unknown",
)
# Reasons the candidate cannot change by preparing harder.
OUTSIDE = {"position_closed", "salary", "other_candidate"}


def record_stage(stages: Mapping[str, str] | None, status: str, at: str) -> dict[str, str]:
    """Remember when a vacancy first reached each status; later moves keep the first date."""
    result = dict(stages or {})
    if status in STAGES or status == "rejected":
        result.setdefault(status, at)
    return result


def reached(vacancy: Mapping[str, Any]) -> str:
    """The furthest stage a vacancy got to, whatever its status is now."""
    seen = [*(vacancy.get("stages") or {}), vacancy.get("status", "saved")]
    seen.append((vacancy.get("rejection") or {}).get("stage", ""))
    return STAGES[max((STAGES.index(s) for s in seen if s in STAGES), default=0)]


def rejection_stage(vacancy: Mapping[str, Any]) -> str:
    """Where the rejection came: after applying, or after at least one interview."""
    answered = (vacancy.get("rejection") or {}).get("stage")
    if answered in REJECTION_STAGES:
        return answered
    return "interview" if STAGES.index(reached(vacancy)) >= STAGES.index("interview") else "applied"


def next_action(rejection: Mapping[str, Any]) -> dict[str, Any]:
    """One concrete step for the reason the candidate gave."""
    reason, topics = rejection.get("reason", "unknown"), list(rejection.get("topics") or [])
    if reason == "no_reply":
        return {"key": "tailorResume", "topics": []}
    if reason in {"technical", "assignment"} and topics:
        return {"key": "studyTopics", "topics": topics}
    if reason in {"technical", "assignment"}:
        return {"key": "practiceTechnical", "topics": []}
    if reason in {"screening", "behavioral"}:
        return {"key": "practiceStory", "topics": topics}
    if reason == "salary":
        return {"key": "checkSalary", "topics": []}
    return {"key": "keepGoing", "topics": []}


def _week_start(moment: datetime, offset: timedelta) -> datetime:
    local = moment + offset
    monday = (local - timedelta(days=local.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return monday - offset


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole, 3) if whole else None


def summary(
    vacancies: Iterable[Mapping[str, Any]],
    events: Iterable[Mapping[str, Any]],
    now: datetime,
    offset_minutes: int = 0,
    weeks: int = 8,
) -> dict[str, Any]:
    vacancies, events = list(vacancies), list(events)
    offset = timedelta(minutes=offset_minutes)
    furthest = Counter(STAGES.index(reached(v)) for v in vacancies)

    def at_least(stage: str) -> int:
        return sum(n for rank, n in furthest.items() if rank >= STAGES.index(stage))

    counts = [len(vacancies) if s == "saved" else at_least(s) for s in FUNNEL]
    stages = [
        {"stage": s, "count": n, "rate": _rate(n, counts[i - 1]) if i else None}
        for i, (s, n) in enumerate(zip(FUNNEL, counts, strict=True))
    ]

    rejected = [v for v in vacancies if v.get("status") == "rejected"]
    reviewed = [v["rejection"] for v in rejected if v.get("rejection")]
    by_reason = Counter(r["reason"] for r in reviewed)

    this_week = _week_start(now, offset)
    starts = [this_week - timedelta(days=7 * i) for i in range(weeks - 1, -1, -1)]

    def week_of(moment: str) -> int | None:
        when = datetime.fromisoformat(moment)
        for i in range(len(starts) - 1, -1, -1):
            if when >= starts[i]:
                return i if when < starts[i] + timedelta(days=7) else None
        return None

    effort: list[dict[str, Any]] = [
        {"week": start.isoformat(), "applications": 0, "practice": 0, "modules": 0, "reviews": 0}
        for start in starts
    ]

    def add(moment: str | None, key: str) -> None:
        index = week_of(moment) if moment else None
        if index is not None:
            effort[index][key] += 1

    for vacancy in vacancies:
        add((vacancy.get("stages") or {}).get("applied"), "applications")
        add((vacancy.get("rejection") or {}).get("created_at"), "reviews")
    for event in events:
        if event["kind"] == "interview_completed":
            add(event["at"], "practice")
        elif event["kind"] == "module_completed":
            add(event["at"], "modules")

    return {
        "total": len(vacancies),
        "active": sum(v.get("status", "saved") in ACTIVE for v in vacancies),
        "stages": stages,
        "rejections": {
            "total": len(rejected),
            "reviewed": len(reviewed),
            "by_stage": [
                {"stage": s, "count": sum(rejection_stage(v) == s for v in rejected)}
                for s in REJECTION_STAGES
            ],
            "by_reason": [{"reason": r, "count": n} for r, n in by_reason.most_common()],
        },
        "effort": effort,
        "insights": insights(effort, counts, len(rejected), reviewed),
    }


def _busy(week: Mapping[str, int]) -> bool:
    return bool(week["applications"] or week["practice"] or week["modules"])


def insights(
    effort: list[dict[str, Any]],
    counts: list[int],
    rejected: int,
    reviewed: list[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Feedback built only from recorded effort and outcomes, newest week last in `effort`."""
    result: list[dict[str, Any]] = []
    current, previous = effort[-1], effort[-2] if len(effort) > 1 else None
    if _busy(current):
        result.append(
            {
                "key": "thisWeek",
                "params": {k: current[k] for k in ("applications", "practice", "modules")},
            }
        )
    elif previous and _busy(previous):
        result.append({"key": "restart", "params": {}})
    streak = 0
    # This week may still be empty; the streak then counts from last week.
    for week in reversed(effort[:-1] if not _busy(current) else effort):
        if not _busy(week):
            break
        streak += 1
    if streak >= 2:
        result.append({"key": "streak", "params": {"weeks": streak}})
    interviews = counts[FUNNEL.index("interview")]
    if interviews:
        result.append({"key": "interviews", "params": {"count": interviews}})
    reasons = Counter(r["reason"] for r in reviewed)
    if len(reviewed) >= 3:
        reason, count = reasons.most_common(1)[0]
        if count * 2 >= len(reviewed) and reason not in OUTSIDE and reason != "unknown":
            result.append(
                {
                    "key": "pattern",
                    "params": {"reason": reason, "count": count, "total": len(reviewed)},
                }
            )
    outside = sum(reasons[r] for r in OUTSIDE)
    if outside:
        result.append({"key": "outside", "params": {"count": outside}})
    if reviewed:
        result.append({"key": "reviewed", "params": {"count": len(reviewed)}})
    if rejected > len(reviewed):
        result.append({"key": "unreviewed", "params": {"count": rejected - len(reviewed)}})
    return result
