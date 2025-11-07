from typing import List, Optional, Dict

from pydantic import BaseModel


class RoadmapModule(BaseModel):
    title: str
    description: Optional[str]
    resources: List[Dict]
    estimated_time: Optional[str]
    progress: int = 0


class Roadmap(BaseModel):
    profession: str
    modules: List[RoadmapModule]
    overall_progress: int = 0
