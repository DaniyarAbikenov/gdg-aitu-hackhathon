"""Progress counters and milestone rewards backed by saved records."""

from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.application.ports import ResumeRepository
from app.domain.career import CareerRecord, CareerRepository
from app.domain.errors import Conflict, InvalidDocument
from app.domain.learning import LearningPlan
from app.domain.models import Session
from app.domain.progress import average, milestones


class ProgressService:
    def __init__(self, store: CareerRepository, resumes: ResumeRepository):
        self.store, self.resumes = store, resumes

    def summary(self, session: Session) -> dict[str, Any]:
        plans = [LearningPlan.from_record(p) for p in self.store.list("plan", session.owner)]
        interviews = self.store.list("interview", session.owner)
        versions = self.store.list("version", session.owner)
        completed = sum(p.completed_modules for p in plans)
        scores = [i.data["score"] for i in interviews if i.data["finished"]]
        earned = {r.data["key"] for r in self.store.list("reward", session.owner)}
        return {
            "completed_modules": completed,
            "total_modules": sum(len(p.modules) for p in plans),
            "interviews_completed": len(scores),
            "average_score": average(scores),
            "resume_versions": len(versions),
            "resumes": len(self.resumes.list(session.owner)),
            "rewards": [
                {
                    "key": m.key,
                    "title": m.title,
                    "available": m.available,
                    "claimed": m.key in earned,
                }
                for m in milestones(completed, max(scores, default=None), len(versions))
            ],
        }

    def claim(self, session: Session, key: str) -> CareerRecord:
        reward = next((r for r in self.summary(session)["rewards"] if r["key"] == key), None)
        if not reward or not reward["available"]:
            raise InvalidDocument("Complete the milestone before claiming it.")
        if reward["claimed"]:
            raise Conflict
        # A stable id makes concurrent claims of the same milestone collide.
        reward_id = str(uuid5(NAMESPACE_URL, session.owner + key))
        return self.store.create("reward", session, {"key": key}, reward_id)
