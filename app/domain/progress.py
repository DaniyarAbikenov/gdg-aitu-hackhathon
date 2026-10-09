"""Milestones are derived from saved activity; nothing here measures employability."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Milestone:
    key: str
    title: str
    available: bool


def milestones(completed_modules: int, best_score: int | None, versions: int) -> list[Milestone]:
    return [
        Milestone("first-step", "First step", completed_modules >= 1),
        Milestone("interview", "Interview practice", best_score is not None and best_score >= 70),
        Milestone("resume", "Resume explorer", versions >= 3),
        Milestone("persistence", "Persistence", completed_modules >= 5),
    ]


def average(scores: list[int]) -> int | None:
    return round(sum(scores) / len(scores)) if scores else None
