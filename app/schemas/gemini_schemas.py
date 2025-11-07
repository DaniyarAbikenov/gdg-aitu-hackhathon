from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class ExperienceItem(BaseModel):
    position: str = Field(..., description="Job title or position")
    company: str = Field(..., description="Company or organisation")
    start_date: Optional[str] = Field(None, description="Start date (e.g., 2020)")
    end_date: Optional[str] = Field(None, description="End date or \"Present\"")
    description: Optional[str] = Field("", description="Short description of role and achievements")


class EducationItem(BaseModel):
    institution: str = Field(..., description="University or educational institution")
    degree: str = Field(..., description="Degree or certificate obtained")
    start_date: Optional[str]
    end_date: Optional[str]


class ProjectItem(BaseModel):
    name: str = Field(..., description="Project title")
    description: Optional[str] = Field("", description="Project description")
    technologies: List[str] = Field(default_factory=list, description="Technologies used")


class ResumeSchema(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = ""
    summary: Optional[str] = ""
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)


class Improvement(BaseModel):
    id: str = Field(..., description="Unique ID for the improvement")
    section: str = Field(..., description="resume section: summary | skills | experience | education | projects")
    change_type: str = Field(..., description="e.g., rewrite, add, remove, modify")
    before: Optional[str] = ""
    after: Optional[str] = ""
    reason: str = Field(..., description="Why the change is needed")


class ImprovementsResponse(BaseModel):
    improvements: List[Improvement]


class InterviewQuestion(BaseModel):
    question: str
    answer: str


class InterviewQuestionList(BaseModel):
    items: list[InterviewQuestion]


class InterviewStartRequest(BaseModel):
    company_description: str
    job_description: str
    tech_stack: str
    style: str  # "theoretical" | "practical" | "mixed"


class InterviewAnswerRequest(BaseModel):
    answer: str


class EvaluationResult(BaseModel):
    result: Literal["correct", "partial", "wrong"] = Field(
        ...,
        description="Оценка ответа кандидата."
    )
    feedback: str = Field(
        ...,
        description="Короткое объяснение оценки."
    )
    follow_up_question: Optional[str] = Field(
        None,
        description="Уточняющий вопрос, если result == 'partial'. Иначе null."
    )
    next_question: Optional[str] = Field(
        None,
        description="Следующий вопрос, если result == 'wrong'. Иначе null."
    )


class InterviewSummaryResponse(BaseModel):
    summary: str = Field(..., description="Общее описание кандидата")
    strengths: List[str] = Field(..., description="Сильные стороны")
    weaknesses: List[str] = Field(..., description="Слабые стороны")
    recommendations: List[str] = Field(..., description="Рекомендации по улучшению")
    estimated_level: str = Field(..., description="Оценка уровня кандидата")
