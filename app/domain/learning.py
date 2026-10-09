"""Eight-week learning plans and their completion evidence."""

from dataclasses import dataclass, field
from typing import Any

from app.domain.career import CareerRecord
from app.domain.errors import NotFound


@dataclass
class LearningPlan:
    id: str
    revision: int
    created_at: str
    data: dict[str, Any]
    modules: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_record(cls, record: CareerRecord) -> "LearningPlan":
        return cls(
            record.id, record.revision, record.created_at, record.data, record.data["modules"]
        )

    def to_data(self) -> dict[str, Any]:
        return {**self.data, "modules": self.modules}

    def module(self, module_id: str) -> dict[str, Any]:
        found = next((m for m in self.modules if m["id"] == module_id), None)
        if not found:
            raise NotFound
        return found

    def update_module(self, module_id: str, completed: bool, evidence: str) -> None:
        self.module(module_id).update(completed=completed, evidence=evidence)

    @property
    def completed_modules(self) -> int:
        return sum(bool(m["completed"]) for m in self.modules)

    def as_text(self) -> str:
        lines = [self.data["goal"], self.data["explanation"], f"Provider: {self.data['provider']}"]
        for week in self.modules:
            lines += [
                f"\nWeek {week['id']}: {week['title']} ({week['hours']} hours)",
                *week["goals"],
                week["exercise"],
                "Resource topic: " + week["resource_topic"],
                "Completed: " + str(week["completed"]),
                "Evidence: " + week["evidence"],
            ]
        return "\n".join(lines)
