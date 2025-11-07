from typing import List, Optional

from pydantic import BaseModel


class QA(BaseModel):
    question: str
    user_answer: Optional[str]
    feedback: Optional[str]
    score: Optional[float]


class InterviewSession(BaseModel):
    job_title: str
    questions: List[QA]
    completed: bool = False
