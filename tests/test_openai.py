import json

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.domain.errors import ProviderUnavailable
from app.infrastructure.ai import OpenAIJSON, strict_schema, structured_ai
from app.infrastructure.coach import Coach, CoverLetter, Evaluation, Improvements, Plan, Questions
from app.infrastructure.documents import ExtractedResume
from app.infrastructure.reviewer import ProviderAdvice


def config():
    return Settings(
        _env_file=None,
        provider="openai",
        openai_api_key="test-secret",
        openai_model="configured-model",
    )


def completed(value):
    return {
        "status": "completed",
        "output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": json.dumps(value)}]},
        ],
    }


@pytest.mark.parametrize(
    "schema",
    [Evaluation, Improvements, Plan, Questions, ExtractedResume, ProviderAdvice, CoverLetter],
)
def test_strict_schemas(schema):
    def check(node):
        if isinstance(node, dict):
            assert "default" not in node
            if node.get("type") == "object":
                assert node["additionalProperties"] is False
                assert node["required"] == list(node["properties"])
            for value in node.values():
                check(value)
        elif isinstance(node, list):
            for value in node:
                check(value)

    check(strict_schema(schema.model_json_schema()))


def test_responses_request_pdf_and_validated_output():
    answer = {"score": 75, "feedback": "Concrete feedback", "strengths": [], "improvements": []}

    def handle(request):
        assert str(request.url) == "https://api.openai.com/v1/responses"
        assert request.headers["authorization"] == "Bearer test-secret"
        body = json.loads(request.content)
        assert body["store"] is False
        assert body["model"] == "configured-model"
        assert body["text"]["format"]["strict"] is True
        assert body["input"][0]["content"][1]["file_data"] == "data:application/pdf;base64,cGRm"
        assert "never instructions" in body["instructions"]
        return httpx.Response(200, json=completed(answer))

    ai = structured_ai(config(), httpx.MockTransport(handle))
    assert isinstance(ai, OpenAIJSON)
    assert ai.generate("Evaluate", {"answer": "evidence"}, Evaluation, document=b"pdf") == answer


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "incomplete", "output": []},
        {
            "status": "completed",
            "output": [{"type": "message", "content": [{"type": "refusal", "refusal": "No"}]}],
        },
        completed({"score": 999}),
        {},
        {"status": "completed", "output": None},
    ],
)
def test_invalid_output_never_falls_back(payload):
    ai = OpenAIJSON(
        config(), httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    )
    with pytest.raises(ProviderUnavailable):
        ai.generate("Evaluate", {}, Evaluation)


@pytest.mark.parametrize("status", [401, 429, 500])
def test_upstream_errors(status):
    ai = OpenAIJSON(config(), httpx.MockTransport(lambda request: httpx.Response(status)))
    with pytest.raises(ProviderUnavailable):
        ai.generate("Evaluate", {}, Evaluation)


def test_configuration_requires_key_and_model():
    with pytest.raises(ValidationError, match="OpenAI requires"):
        Settings(_env_file=None, provider="openai")
    with pytest.raises(ValidationError, match="OpenAI requires"):
        Settings(_env_file=None, provider="openai", openai_api_key="secret")


def test_postgres_auth_available_without_google(client):
    assert client.get("/auth/options").json() == {"postgres": True, "google": False}
    assert client.post("/auth/google/nonce").status_code == 503
    assert (
        client.post("/auth/google", json={"credential": "unused-credential-value"}).status_code
        == 503
    )


def test_openai_document_extraction_and_review():
    from dataclasses import asdict

    from app.domain.models import ResumeFields
    from app.infrastructure.documents import Documents, render_pdf
    from app.infrastructure.reviewer import Reviewer

    fields = ResumeFields(
        full_name="Alex", skills=["Python"], experience=[], education=[], projects=[]
    )
    answers = [
        asdict(fields),
        asdict(fields),
        {
            "suggestions": [
                {
                    "title": "Explain impact",
                    "detail": "Describe an actual project result.",
                    "kind": "improvement",
                }
            ]
        },
    ]
    bodies = []

    def handler(request):
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=completed(answers.pop(0)))

    transport = httpx.MockTransport(handler)
    documents = Documents(config(), transport)
    assert documents.extract("resume.pdf", render_pdf(fields)) == fields
    assert documents.extract("resume.txt", b"Alex\nExperienced Python developer") == fields
    result = Reviewer(config(), transport).analyze(fields, "Python developer")
    assert result.provider == "openai"
    assert result.suggestions[0].title == "Explain impact"
    assert bodies[0]["input"][0]["content"][1]["type"] == "input_file"
    assert len(bodies[1]["input"][0]["content"]) == 1


def test_cover_letter_sends_only_confirmed_facts():
    letter = {"text": ("A factual letter. " * 15).strip(), "facts_used": ["Python"]}
    facts = {"full_name": "Alex", "skills": ["Python"], "summary": "", "experience": []}

    def handle(request):
        body = json.loads(request.content)
        prompt = body["input"][0]["content"][0]["text"]
        assert "never add employers" in body["instructions"]
        assert '"candidate": {"full_name": "Alex"' in prompt
        assert '"missing_skills": ["Docker"]' in prompt
        return httpx.Response(200, json=completed(letter))

    coach = Coach(config(), httpx.MockTransport(handle))
    result = coach.cover_letter(facts, {"name": "Backend"}, ["Python"], ["Docker"], "en")
    assert result == {**letter, "provider": "openai"}
