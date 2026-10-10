from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.periods import normalize_period
from app.domain.skills import skill_key, skill_name


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, from_attributes=True)


class Experience(StrictModel):
    id: str = Field(default="", max_length=40)
    company: str = Field(default="", max_length=300)
    role: str = Field(default="", max_length=300)
    date_from: str = Field(default="", max_length=50)
    date_to: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=200)
    responsibilities: str = Field(default="", max_length=6000)
    achievements: list[str] = Field(default_factory=list, max_length=40)

    @field_validator("date_from", "date_to")
    @classmethod
    def period_format(cls, value, info):
        try:
            return normalize_period(value, end=info.field_name == "date_to")
        except ValueError:
            # Legacy free-text periods remain readable; mutation contracts validate new input.
            return value


class Education(StrictModel):
    id: str = Field(default="", max_length=40)
    institution: str = Field(default="", max_length=300)
    degree: str = Field(default="", max_length=300)
    year_start: int = Field(default=0, ge=0, le=2200)
    year_end: int = Field(default=0, ge=0, le=2200)


class Project(StrictModel):
    id: str = Field(default="", max_length=40)
    title: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=6000)
    tech: list[str] = Field(default_factory=list, max_length=60)


class Award(StrictModel):
    """An achievement outside a single job: a competition, award, publication or certificate."""

    id: str = Field(default="", max_length=40)
    title: str = Field(default="", max_length=300)
    detail: str = Field(default="", max_length=2000)
    year: int = Field(default=0, ge=0, le=2200)


class ResumeFields(StrictModel):
    position: str = Field(default="", max_length=200)
    full_name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=3000)
    skills: list[str] = Field(default_factory=list, max_length=60)
    experience: str | list[Experience] = Field(default="", max_length=12000)
    education: str | list[Education] = Field(default="", max_length=3000)

    phone: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    projects: str | list[Project] = Field(default="", max_length=6000)
    certificates: str = Field(default="", max_length=3000)
    languages: str = Field(default="", max_length=500)
    awards: list[Award] = Field(default_factory=list, max_length=40)
    interests: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, interests):
        result = []
        for item in interests:
            item = " ".join(item.split())
            if not item or len(item) > 80:
                raise ValueError("Interests must contain between 1 and 80 characters")
            if item.casefold() not in {i.casefold() for i in result}:
                result.append(item)
        return result

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, skills):
        result = []
        for skill in skills:
            skill = skill_name(skill)
            if not skill or len(skill) > 80:
                raise ValueError("Skills must contain between 1 and 80 characters")
            if skill_key(skill) not in {skill_key(s) for s in result}:
                result.append(skill)
        return result
