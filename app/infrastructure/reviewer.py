from dataclasses import asdict
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.errors import ProviderUnavailable
from app.domain.models import Suggestion
from app.domain.review import compare
from app.infrastructure.ai import structured_ai


class AdviceItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(min_length=1, max_length=900)
    kind: Literal["strength", "improvement", "gap"]


class ProviderAdvice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suggestions: list[AdviceItem] = Field(min_length=1, max_length=8)


class Reviewer:
    def __init__(self, settings, transport=None, meter=None):
        self.settings = settings
        self.transport, self.meter = transport, meter

    def analyze(self, fields, jd_text):
        if self.settings.provider == "unconfigured":
            raise ProviderUnavailable
        result = compare(fields, jd_text)
        if self.settings.provider == "local":
            return result
        advice = structured_ai(self.settings, self.transport, self.meter).generate(
            "Review the resume for its author. Return actionable, factual suggestions, "
            "not a hiring decision or ATS score. Use only the provided evidence.",
            {"resume": asdict(fields), "job_description": jd_text},
            ProviderAdvice,
        )
        result.provider = self.settings.provider
        result.suggestions = [Suggestion(**item) for item in advice["suggestions"]]
        return result
