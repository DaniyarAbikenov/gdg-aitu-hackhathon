from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, from_attributes=True)


class ResumeFields(StrictModel):
    full_name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=3000)
    skills: list[str] = Field(default_factory=list, max_length=60)
    experience: str = Field(default="", max_length=12000)
    education: str = Field(default="", max_length=3000)

    phone: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    projects: str = Field(default="", max_length=6000)
    certificates: str = Field(default="", max_length=3000)
    languages: str = Field(default="", max_length=500)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, skills):
        result = []
        for skill in skills:
            skill = skill.strip()
            if not skill or len(skill) > 80:
                raise ValueError("Skills must contain between 1 and 80 characters")
            if skill.casefold() not in {s.casefold() for s in result}:
                result.append(skill)
        return result


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
    provider: Literal["local", "gemini"]
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
