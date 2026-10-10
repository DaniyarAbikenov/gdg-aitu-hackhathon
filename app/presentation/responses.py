"""Response contracts. They document the API for the generated frontend client.

Models allow extra keys so documents written by earlier releases are returned unchanged.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.contracts import ResumeFields


class View(BaseModel):
    model_config = ConfigDict(extra="allow")


class Record(View):
    id: str
    revision: int
    created_at: str
    data: dict[str, Any]


class ProfileData(ResumeFields):
    model_config = ConfigDict(extra="allow")
    desired_position: str = ""
    career_goal: str = ""
    language: Literal["en", "ru", "kk"] = "en"
    audio_mode: bool = False
    extra: dict[str, list[str]] = Field(default_factory=dict)


class ProfileRecord(View):
    id: str
    revision: int
    data: ProfileData


class InterviewContext(View):
    company_description: str = ""
    job_description: str = ""
    tech_stack: str = ""
    company_name: str = ""
    vacancy_title: str = ""
    company_id: str = ""
    vacancy_id: str = ""
    mode: Literal["text", "voice"] = "text"
    style: str = "mixed"
    language: str = "en"


class InterviewAnswer(View):
    question: str
    answer: str
    reference_answer: str = ""
    criteria: list[str] = Field(default_factory=list)
    score: int
    feedback: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)


class TranscriptTurn(View):
    id: str
    role: Literal["user", "assistant"]
    text: str


class InterviewView(View):
    id: str
    revision: int
    created_at: str
    context: InterviewContext
    provider: str
    answers: list[InterviewAnswer]
    finished: bool
    score: int | None
    total_questions: int
    question: str | None
    transcript: list[TranscriptTurn]


class PlanModule(View):
    id: str
    title: str
    goals: list[str]
    exercise: str
    hours: int
    resource_topic: str
    completed: bool
    evidence: str


class PlanData(View):
    goal: str
    explanation: str = ""
    provider: str = ""
    modules: list[PlanModule]
    vacancy_id: str | None = None
    resume_id: str | None = None
    interview_id: str | None = None


class PlanRecord(View):
    id: str
    revision: int
    created_at: str
    data: PlanData


class VersionData(View):
    resume_id: str
    label: str
    fields: ResumeFields
    before: ResumeFields
    jd_text: str = ""


class VersionRecord(View):
    id: str
    revision: int
    created_at: str
    data: VersionData


class Reward(View):
    key: str
    title: str
    available: bool
    claimed: bool


class Progress(View):
    completed_modules: int
    total_modules: int
    interviews_completed: int
    average_score: int | None
    resume_versions: int
    resumes: int
    rewards: list[Reward]


class SkillGap(View):
    name: str
    mentions: int


class Week(View):
    current: int
    previous: int
    learning_current: int
    learning_previous: int


class DailyActivity(View):
    date: str
    count: int


class Overview(Progress):
    goal: str
    reviewed_resumes: int
    active_resumes: int
    archived_resumes: int
    skill_gaps: list[SkillGap]
    companies: list[str]
    week: Week
    activity: list[DailyActivity]
    recent: list[dict[str, Any]]
    xp: int
    level: int
    level_progress: int
    streak: int
    tracking_started: str | None


class PreferencesRecord(View):
    revision: int
    data: dict[str, list[str]]


ApplicationStatus = Literal[
    "saved", "preparing", "applied", "interview", "offer", "rejected", "archived"
]
RejectionStage = Literal["applied", "interview"]
RejectionReason = Literal[
    "no_reply",
    "screening",
    "technical",
    "assignment",
    "behavioral",
    "position_closed",
    "salary",
    "other_candidate",
    "unknown",
]


class Rejection(View):
    stage: RejectionStage
    reason: RejectionReason
    topics: list[str] = Field(default_factory=list)
    feedback: str = ""
    created_at: str


class NextAction(View):
    key: Literal[
        "tailorResume",
        "studyTopics",
        "practiceTechnical",
        "practiceStory",
        "checkSalary",
        "keepGoing",
    ]
    topics: list[str]


class RejectionResult(View):
    revision: int
    rejection: Rejection
    next_action: NextAction


class FunnelStage(View):
    stage: Literal["saved", "applied", "interview", "offer"]
    count: int
    rate: float | None = Field(description="Share of the previous stage that reached this one")


class StageCount(View):
    stage: RejectionStage
    count: int


class ReasonCount(View):
    reason: RejectionReason
    count: int


class Rejections(View):
    total: int
    reviewed: int
    by_stage: list[StageCount]
    by_reason: list[ReasonCount]


class EffortWeek(View):
    week: str = Field(description="Start of the week (Monday 00:00 in the browser's offset), UTC")
    applications: int
    practice: int
    modules: int
    reviews: int


class Insight(View):
    key: Literal[
        "thisWeek",
        "restart",
        "streak",
        "interviews",
        "pattern",
        "outside",
        "reviewed",
        "unreviewed",
    ]
    params: dict[str, int | str]


class Funnel(View):
    total: int
    active: int
    stages: list[FunnelStage]
    rejections: Rejections
    effort: list[EffortWeek]
    insights: list[Insight]


class ApplicationFields(View):
    name: str = ""
    description: str = ""
    company_name: str = ""
    company_description: str = ""
    company_id: str | None = None
    location: str = ""
    employment: str = ""
    salary: str = ""
    requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    status: ApplicationStatus = "saved"
    source_url: str | None = None
    resume_id: str | None = None
    notes: str = ""
    next_action: str = ""
    follow_up: str | None = None
    cover_letter: str = ""
    stages: dict[str, str] = Field(
        default_factory=dict, description="When the vacancy first reached each status"
    )
    rejection: Rejection | None = None


class LinkedInterview(View):
    id: str
    finished: bool
    mode: str
    score: int | None


class LinkedPlan(View):
    id: str
    goal: str


class ApplicationItem(View):
    id: str
    revision: int
    created_at: str
    data: ApplicationFields
    next_step: str
    next_step_key: str
    resume_title: str | None
    interviews: list[LinkedInterview]
    plans: list[LinkedPlan]
    rejection_action: NextAction | None = None


class JobError(View):
    code: str
    detail: str = ""


class JobView(View):
    """`result` has the same shape as the synchronous response of the operation."""

    id: str
    operation: str
    status: Literal["queued", "running", "done", "failed"]
    result: Any = None
    error: JobError | None = None


class CoverLetterDraft(View):
    text: str
    facts_used: list[str]
    provider: str
    matched_skills: list[str]
    missing_skills: list[str]
    resume_id: str | None


class UsageTotals(View):
    calls: int
    failed: int
    input_tokens: int
    output_tokens: int
    cost_usd: float | None


class OperationUsage(UsageTotals):
    provider: str
    model: str
    operation: str
    average_ms: int


class DailyUsage(View):
    day: str
    calls: int
    input_tokens: int
    output_tokens: int
    cost_usd: float | None


class AiUsage(View):
    days: int
    priced: bool
    totals: UsageTotals
    operations: list[OperationUsage]
    daily: list[DailyUsage]


class ProfileChange(BaseModel):
    """One difference between the master profile and a resume."""

    id: str
    kind: Literal["update", "review", "new", "removed"]
    section: str
    key: str
    label: str
    resume: Any = None
    profile: Any = None
    demand: int = 0


class ProfileChanges(BaseModel):
    resume_id: str
    revision: int
    profile_revision: int
    linked: bool
    status: Literal["current", "suggestions", "outdated", "review"]
    changes: list[ProfileChange]
