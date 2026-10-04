from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ResumeFields:
    position: str = ""
    full_name: str = ""
    email: str = ""
    summary: str = ""
    skills: list[str] = field(default_factory=list)
    experience: str | list[dict] = ""
    education: str | list[dict] = ""
    phone: str = ""
    location: str = ""
    projects: str | list[dict] = ""
    certificates: str = ""
    languages: str = ""


@dataclass
class Suggestion:
    title: str
    detail: str
    kind: str


@dataclass
class Analysis:
    provider: str
    matched_skills: list[str]
    missing_skills: list[str]
    suggestions: list[Suggestion]


@dataclass
class ResumeRecord:
    resume_id: str
    filename: str
    fields: ResumeFields
    status: str
    revision: int
    created_at: str
    analysis: Analysis | None = None
    jd_text: str = ""
    title: str = ""
    description: str = ""
    lifecycle: str = "draft"
    updated_at: str = ""


@dataclass(frozen=True)
class Session:
    owner: str
    expires_at: datetime
    persistent: bool = False
