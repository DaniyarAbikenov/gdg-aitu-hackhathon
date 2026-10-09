"""Token usage is metered per provider call and summarized for administrators."""

import httpx
import pytest
from sqlalchemy import text

from app.application.ports import AiCall
from app.config import Settings
from app.domain.errors import ProviderUnavailable
from app.infrastructure.ai import GeminiJSON, OpenAIJSON
from app.infrastructure.coach import Evaluation
from tests.test_openai import completed, config
from tests.test_product import allow_admins, member

EVALUATION = {"score": 70, "feedback": "Clear", "strengths": [], "improvements": []}


def test_openai_reports_tokens_for_success_and_failure():
    calls: list[AiCall] = []
    ok = OpenAIJSON(
        config(),
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={**completed(EVALUATION), "usage": {"input_tokens": 120, "output_tokens": 30}},
            )
        ),
        calls.append,
    )
    ok.generate("Evaluate", {}, Evaluation)
    broken = OpenAIJSON(
        config(), httpx.MockTransport(lambda request: httpx.Response(500)), calls.append
    )
    with pytest.raises(ProviderUnavailable):
        broken.generate("Evaluate", {}, Evaluation)

    first, second = calls
    assert (first.provider, first.model, first.operation) == (
        "openai",
        "configured-model",
        "Evaluation",
    )
    assert (first.input_tokens, first.output_tokens, first.succeeded) == (120, 30, True)
    assert (second.input_tokens, second.output_tokens, second.succeeded) == (0, 0, False)
    assert first.duration_ms >= 0


def test_gemini_counts_thinking_tokens_as_output():
    calls: list[AiCall] = []
    settings = Settings(
        _env_file=None, provider="gemini", gemini_api_key="test-secret", gemini_model="flash"
    )
    body = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"score": 70, "feedback": "Clear", "strengths": [], "improvements": []}'
                        }
                    ]
                }
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 80,
            "candidatesTokenCount": 20,
            "thoughtsTokenCount": 5,
        },
    }
    GeminiJSON(
        settings, httpx.MockTransport(lambda r: httpx.Response(200, json=body)), calls.append
    ).generate("Evaluate", {}, Evaluation)
    [call] = calls
    assert (call.provider, call.input_tokens, call.output_tokens) == ("gemini", 80, 25)


def record(client, operation, sent, received, ok=True, model="model-a"):
    client.app.state.container.ai_usage.record(
        AiCall("openai", model, operation, sent, received, 900, ok)
    )


def test_admin_summary_with_and_without_prices(client, settings):
    engine = client.app.state.container.repository.engine
    with engine.begin() as db:
        db.execute(text("TRUNCATE ai_usage"))
    email = member(client)
    assert client.get("/admin/ai-usage").status_code == 403
    allow_admins(client, email)

    record(client, "CoverLetter", 1000, 400)
    record(client, "CoverLetter", 3000, 600)
    record(client, "Questions", 500, 0, ok=False)
    report = client.get("/admin/ai-usage?days=7").json()
    assert report["priced"] is False and report["totals"]["cost_usd"] is None
    assert report["totals"] == {
        "calls": 3,
        "failed": 1,
        "input_tokens": 4500,
        "output_tokens": 1000,
        "cost_usd": None,
    }
    letters = report["operations"][0]
    assert letters["operation"] == "CoverLetter" and letters["calls"] == 2
    assert letters["average_ms"] == 900
    [today] = report["daily"]
    assert today["calls"] == 3

    report_case = client.app.state.container.use_cases.ai_usage
    report_case.input_price, report_case.output_price = 2.0, 8.0
    priced = client.get("/admin/ai-usage").json()
    # 4500 * $2 + 1000 * $8 per million tokens.
    assert priced["priced"] is True and priced["totals"]["cost_usd"] == 0.017
    assert client.get("/admin/ai-usage?days=181").status_code == 422


def test_usage_retention(client):
    usage = client.app.state.container.ai_usage
    record(client, "Plan", 10, 10)
    from datetime import UTC, datetime, timedelta

    assert usage.purge(datetime.now(UTC) + timedelta(seconds=1)) >= 1
    assert usage.summary(datetime.now(UTC) - timedelta(days=1))["operations"] == []
