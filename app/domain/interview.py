"""Interview practice: question flow, answer evaluation and the public view."""

from dataclasses import dataclass, field
from typing import Any

from app.domain.career import CareerRecord
from app.domain.errors import Conflict, InvalidDocument

MAX_TRANSCRIPT_TURNS = 200
VOICE_ANSWER_TITLE = "Голосовое интервью"


@dataclass
class Interview:
    """One practice session. Reference answers stay server-side until answered."""

    id: str
    revision: int
    created_at: str
    context: dict[str, Any]
    provider: str
    questions: list[dict[str, Any]] = field(default_factory=list)
    answers: list[dict[str, Any]] = field(default_factory=list)
    transcript: list[dict[str, Any]] = field(default_factory=list)
    finished: bool = False
    score: int | None = None
    call_id: str | None = None
    # Fields written by older releases are preserved on save.
    extra: dict[str, Any] = field(default_factory=dict)

    KNOWN = (
        "context",
        "provider",
        "questions",
        "answers",
        "transcript",
        "finished",
        "score",
        "call_id",
    )

    @classmethod
    def from_record(cls, record: CareerRecord) -> "Interview":
        data = record.data
        return cls(
            id=record.id,
            revision=record.revision,
            created_at=record.created_at,
            context=data["context"],
            provider=data["provider"],
            questions=data.get("questions", []),
            answers=data.get("answers", []),
            transcript=data.get("transcript", []),
            finished=data.get("finished", False),
            score=data.get("score"),
            call_id=data.get("call_id"),
            extra={k: v for k, v in data.items() if k not in cls.KNOWN},
        )

    @staticmethod
    def new_data(
        context: dict[str, Any], provider: str, questions: list[dict[str, Any]]
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "provider": provider,
            "context": context,
            "questions": questions,
            "answers": [],
            "finished": False,
            "score": None,
        }
        if context.get("mode") == "voice":
            data["transcript"] = []
        return data

    def to_data(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            **self.extra,
            "provider": self.provider,
            "context": self.context,
            "questions": self.questions,
            "answers": self.answers,
            "finished": self.finished,
            "score": self.score,
        }
        if self.transcript or self.is_voice:
            data["transcript"] = self.transcript
        if self.call_id:
            data["call_id"] = self.call_id
        return data

    @property
    def is_voice(self) -> bool:
        return self.context.get("mode") == "voice"

    def require_open(self, revision: int) -> None:
        if self.revision != revision or self.finished:
            raise Conflict

    def current_question(self) -> dict[str, Any]:
        return self.questions[len(self.answers)]

    def record_answer(self, answer: str, evaluation: dict[str, Any]) -> None:
        """Store the evaluated answer; the last answer finishes and scores the session."""
        question = self.current_question()
        self.answers.append(
            {
                "question": question["question"],
                "answer": answer,
                "reference_answer": question["reference_answer"],
                "criteria": question["criteria"],
                **evaluation,
            }
        )
        self.finished = len(self.answers) == len(self.questions)
        if self.finished:
            self.score = round(sum(a["score"] for a in self.answers) / len(self.answers))

    def add_turns(self, turns: list[dict[str, Any]]) -> None:
        """Merge transcript turns by id; resent turns never duplicate."""
        merged = {t["id"]: t for t in self.transcript}
        for turn in turns:
            merged.setdefault(turn["id"], turn)
        if len(merged) > MAX_TRANSCRIPT_TURNS:
            raise InvalidDocument("Maximum interview length reached.")
        self.transcript = list(merged.values())

    def transcript_text(self) -> str:
        if not any(t["role"] == "user" for t in self.transcript):
            raise InvalidDocument("Record an answer before finishing the interview.")
        return "\n".join(t["role"] + ": " + t["text"] for t in self.transcript)

    def finish_voice(self, evaluation: dict[str, Any]) -> None:
        self.finished = True
        self.score = evaluation["score"]
        self.answers = [
            {
                "question": VOICE_ANSWER_TITLE,
                "answer": "\n".join(t["text"] for t in self.transcript if t["role"] == "user"),
                "reference_answer": "",
                **evaluation,
            }
        ]

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "revision": self.revision,
            "created_at": self.created_at,
            "context": self.context,
            "provider": self.provider,
            "answers": self.answers,
            "finished": self.finished,
            "score": self.score,
            "total_questions": len(self.questions),
            "question": None
            if self.finished or not self.questions
            else self.current_question()["question"],
            "transcript": self.transcript,
        }
