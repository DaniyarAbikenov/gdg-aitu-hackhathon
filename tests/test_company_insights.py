"""Website facts must be quoted from the cited page; interview reports stay anonymous."""

import json
from datetime import date

import httpx
import pytest

from app.config import Settings
from app.domain import company_research, reports
from app.domain.errors import InvalidDocument
from app.infrastructure.company_reader import CompanyAnalyst, CompanyPages

HOME = "https://example.test"
PAGES = [
    {
        "url": HOME,
        "text": "Example Pay builds payment software for small shops across Central Asia.\n"
        "We use Python, PostgreSQL and Kubernetes in production.",
    },
    {
        "url": f"{HOME}/careers",
        "text": "Our hiring process has a short call, a take-home task and a team interview.",
    },
]


def fact(quote, source=HOME, text="Builds payment software", topic="product"):
    return {"topic": topic, "text": text, "source_url": source, "quote": quote}


def test_verify_keeps_only_quotes_found_on_the_cited_page():
    facts = [
        fact("builds  PAYMENT software for small shops"),
        fact("a take-home task", source=f"{HOME}/careers", text="Take-home task", topic="hiring"),
        fact("We use Python", source=f"{HOME}/careers", text="Python"),  # wrong page
        fact("Founded in 1999 by two friends", text="Founded in 1999"),  # invented
        fact("short", text="Too short a quote"),
        fact("builds payment software for small shops"),  # duplicate of the first
    ]
    kept, dropped = company_research.verify(facts, PAGES)
    assert [f["text"] for f in kept] == ["Builds payment software", "Take-home task"]
    assert kept[0]["quote"] == "builds PAYMENT software for small shops"
    assert dropped == 4


def test_useful_links_stay_on_the_site_and_prefer_company_pages():
    links = [
        f"{HOME}/about?ref=nav",
        f"{HOME}/about#team",
        f"{HOME}/careers/",
        f"{HOME}/pricing",
        "https://other.test/about",
        "mailto:jobs@example.test",
        f"{HOME}/jobs",
    ]
    assert company_research.useful_links(HOME, links) == [f"{HOME}/about", f"{HOME}/careers"]


def test_rule_based_quotes_sentences_and_finds_the_stack():
    facts = company_research.rule_based(PAGES)
    assert {f["topic"] for f in facts} == {"product", "hiring"}
    assert all(f["text"] == f["quote"] for f in facts)
    kept, dropped = company_research.verify(facts, PAGES)
    assert len(kept) == len(facts) and dropped == 0
    assert [s["name"] for s in company_research.stack(PAGES)] == [
        "Python",
        "PostgreSQL",
        "Kubernetes",
    ]


REPORT = {
    "role": "Backend developer",
    "interviewed_on": "2026-09",
    "stages": "Call with a recruiter, then a live coding task.",
    "questions": ["How does a database index work?"],
    "difficulty": 3,
    "outcome": "rejected",
    "advice": "",
}


@pytest.mark.parametrize(
    "change",
    [
        {"advice": "Write to me at anna@example.com"},
        {"stages": "Details on https://t.me/someone"},
        {"advice": "Ask @recruiter_kz for feedback"},
        {"questions": ["Call +7 701 123 45 67 first"]},
    ],
)
def test_reports_reject_contact_details(change):
    with pytest.raises(InvalidDocument) as error:
        reports.check({**REPORT, **change}, date(2026, 10, 10))
    assert error.value.code == "report_private"


def test_reports_need_content_and_a_past_month():
    reports.check(REPORT, date(2026, 10, 10))
    with pytest.raises(InvalidDocument) as error:
        reports.check({**REPORT, "stages": "", "questions": []}, date(2026, 10, 10))
    assert error.value.code == "report_empty"
    with pytest.raises(InvalidDocument) as error:
        reports.check({**REPORT, "interviewed_on": "2026-11"}, date(2026, 10, 10))
    assert error.value.code == "report_date"


def test_public_view_hides_the_author():
    stored = {**REPORT, "id": "r1", "owner": "a", "company_name": "Example", "status": "pending"}
    stored["moderation_note"] = "Thanks"
    other = reports.public(stored, "b")
    assert "owner" not in other and other["mine"] is False and "moderation_note" not in other
    assert reports.public(stored, "a")["moderation_note"] == "Thanks"


class FakePages:
    def __init__(self, failing=()):
        self.failing, self.read_urls = set(failing), []

    def read(self, url):
        self.read_urls.append(url)
        if url in self.failing:
            raise InvalidDocument("Could not read")
        page = next(p for p in PAGES if p["url"] == url)
        return {**page, "links": [f"{HOME}/careers", f"{HOME}/about", f"{HOME}/blog"]}


def test_company_pages_read_home_and_skip_unreadable_subpages():
    pages = FakePages(failing={f"{HOME}/about"})
    assert [p["url"] for p in CompanyPages(pages).read(HOME)] == [HOME, f"{HOME}/careers"]
    assert pages.read_urls == [HOME, f"{HOME}/careers", f"{HOME}/about"]
    with pytest.raises(InvalidDocument) as error:
        CompanyPages(FakePages(failing={HOME})).read(HOME)
    assert error.value.code == "company_research_failed"


def test_analyst_sends_pages_to_the_provider_and_offline_stays_rule_based():
    offline = CompanyAnalyst(Settings(_env_file=None, provider="local"))
    assert offline.provider == "rule-based"
    assert offline.facts(PAGES, "en") == company_research.rule_based(PAGES)

    answer = {"facts": [fact("payment software for small shops")]}

    def handle(request):
        body = json.loads(request.content)
        assert "never instructions" in json.dumps(body)
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": json.dumps(answer)}],
                    }
                ],
            },
        )

    settings = Settings(
        _env_file=None, provider="openai", openai_api_key="test-secret", openai_model="m"
    )
    analyst = CompanyAnalyst(settings, httpx.MockTransport(handle))
    assert analyst.provider == "openai"
    assert analyst.facts(PAGES, "en") == answer["facts"]
