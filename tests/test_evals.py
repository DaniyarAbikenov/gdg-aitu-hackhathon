"""The evaluation checks catch fabricated output, and the local provider passes them."""

import importlib.util
import json
from pathlib import Path

import httpx

from app.infrastructure.coach import Coach
from tests.test_openai import completed, config

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("run_evals", ROOT / "scripts" / "run_evals.py")
evals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evals)
CASE = json.loads((ROOT / "evals" / "cases" / "backend-developer.json").read_text())


def coach_answering(value):
    body = completed(value)
    return Coach(config(), httpx.MockTransport(lambda request: httpx.Response(200, json=body)))


def test_fabricated_letter_fails_every_relevant_check():
    letter = (
        "Dear Sample Payments team, I am experienced in Kubernetes after 10 years at Google, "
        "where I led a team of 25 engineers. " + "I build reliable Python services. " * 8
    )
    result = evals.check_letter(
        coach_answering({"text": letter, "facts_used": ["Python", "Staff engineer at Google"]}),
        CASE,
        "en",
    )
    failures = {name for name, why in result.checks.items() if why}
    assert failures == {
        "facts_used come from the candidate",
        "no invented numbers",
        "no claims outside the facts",
        "missing skills are not claimed",
    }


def test_wrong_language_is_reported():
    letter = "Dear Sample Payments team, I build Python services with FastAPI. " * 5
    result = evals.check_letter(
        coach_answering({"text": letter, "facts_used": ["Python"]}), CASE, "ru"
    )
    assert result.checks["written in the requested language"]


def test_improvements_that_add_skills_or_numbers_fail():
    proposal = {
        "improvements": [
            {
                "section": "skills",
                "before": "Python, FastAPI, PostgreSQL, Docker, Git",
                "after": "Python, FastAPI, PostgreSQL, Docker, Git, Kubernetes",
                "reason": "Match the vacancy",
            },
            {
                "section": "summary",
                "before": "Backend developer who builds and tests Python web services.",
                "after": "Backend developer with 5 years of Python.",
                "reason": "Stronger",
            },
        ]
    }
    result = evals.check_improvements(coach_answering(proposal), CASE)
    assert "Kubernetes" in result.checks["no new skills"]
    assert "5" in result.checks["no invented numbers"]


def test_local_provider_passes_all_cases(monkeypatch, capsys):
    monkeypatch.setenv("CAREER_PROVIDER", "local")
    monkeypatch.setattr("sys.argv", ["run_evals.py"])
    assert evals.main() == 0
    assert "No provider calls" in capsys.readouterr().out
