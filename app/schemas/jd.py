from pydantic import BaseModel
from typing import List

class JobDescription(BaseModel):
    raw_text: str
    parsed_skills: List[str] = []
    parsed_requirements: List[str] = []
    ai_summary: str = ""
