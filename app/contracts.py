from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, from_attributes=True)


class Experience(StrictModel):
    company: str = Field(default="", max_length=300)
    role: str = Field(default="", max_length=300)
    date_from: str = Field(default="", max_length=50)
    date_to: str = Field(default="", max_length=50)
    achievements: list[str] = Field(default_factory=list, max_length=40)


class Education(StrictModel):
    institution: str = Field(default="", max_length=300)
    degree: str = Field(default="", max_length=300)
    year_start: int = Field(default=0, ge=0, le=2200)
    year_end: int = Field(default=0, ge=0, le=2200)


class Project(StrictModel):
    title: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=6000)
    tech: list[str] = Field(default_factory=list, max_length=60)


class ResumeFields(StrictModel):
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
