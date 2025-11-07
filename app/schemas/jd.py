from typing import List

from pydantic import BaseModel


class JobDescription(BaseModel):
    raw_text: str
    parsed_skills: List[str] = []
    parsed_requirements: List[str] = []
    ai_summary: str = ""
