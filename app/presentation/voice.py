from typing import Literal
from uuid import UUID

from fastapi import APIRouter
from pydantic import Field

from app.contracts import StrictModel
from app.presentation.dependencies import Cases, Workspace
from app.presentation.responses import InterviewView


class Offer(StrictModel):
    sdp: str = Field(min_length=10, max_length=100000)
    revision: int = Field(ge=1)


class Turn(StrictModel):
    id: str = Field(min_length=1, max_length=200)
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=10000)


class Transcript(StrictModel):
    revision: int = Field(ge=1)
    turns: list[Turn] = Field(max_length=200)
    finish: bool = False


def voice_router() -> APIRouter:
    routes = APIRouter()

    @routes.post("/interview/{id}/voice/connect")
    def connect(id: UUID, payload: Offer, cases: Cases, current: Workspace):
        return cases.voice.connect(current, str(id), payload.revision, payload.sdp)

    @routes.post("/interview/{id}/voice/transcript", response_model=InterviewView)
    def transcript(id: UUID, payload: Transcript, cases: Cases, current: Workspace):
        return cases.voice.save_transcript(
            current,
            str(id),
            payload.revision,
            [turn.model_dump() for turn in payload.turns],
            payload.finish,
        )

    @routes.post("/interview/{id}/voice/stop", status_code=204)
    def stop(id: UUID, cases: Cases, current: Workspace):
        cases.voice.stop(current, str(id))

    return routes
