from typing import Literal

from pydantic import Field

from app.contracts import ResumeFields, StrictModel


class SaveRequest(StrictModel):
    fields: ResumeFields
    revision: int = Field(ge=1)


class AnalyzeRequest(StrictModel):
    jd_text: str = Field(min_length=30, max_length=15000)
    revision: int = Field(ge=1)


class Suggestion(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(min_length=1, max_length=900)
    kind: Literal["strength", "improvement", "gap"]


class ProviderAdvice(StrictModel):
    suggestions: list[Suggestion] = Field(min_length=1, max_length=8)


class Analysis(StrictModel):
    provider: Literal["local", "gemini", "openai"]
    matched_skills: list[str]
    missing_skills: list[str]
    suggestions: list[Suggestion]


class ResumeRecord(StrictModel):
    resume_id: str
    filename: str
    fields: ResumeFields
    status: Literal["extracted", "edited", "reviewed"]
    revision: int
    created_at: str
    analysis: Analysis | None = None
    jd_text: str = ""
