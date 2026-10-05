import io
from dataclasses import asdict

import httpx
import pytest
from pydantic import ValidationError
from pypdf import PdfWriter

from app.config import Settings
from app.domain.errors import InvalidDocument, ProviderUnavailable
from app.domain.models import ResumeFields
from app.domain.review import compare, extract_fields, skills_in
from app.infrastructure.documents import extract_text, render_pdf
from app.infrastructure.reviewer import Reviewer
from app.presentation.schemas import ResumeFields as FieldsSchema


def test_skill_boundaries_and_factual_gaps():
    assert skills_in("I enjoy going outside and speak Javanese.") == []
    assert skills_in("C++, C#, PostgreSQL and node.js") == ["Node.js", "C++", "C#", "PostgreSQL"]
    fields = ResumeFields(skills=["Python"])
    review = compare(fields, "Python with Docker and Redis required")
    assert review.matched_skills == ["Python"]
    assert review.missing_skills == ["Redis", "Docker"]
    assert fields.skills == ["Python"]
    assert len(compare(fields, "An experienced human to lead teams").suggestions) >= 2


def test_extract_and_unicode_pdf_roundtrip():
    fields = extract_fields(
        "Данияр Абикенов\ndaniyar@example.com\nSummary\nAPI developer\nSkills\nPython\nExperience\nBuilt 3 APIs\nEducation\nUniversity"
    )
    assert fields.full_name == "Данияр Абикенов"
    assert fields.email == "daniyar@example.com"
    assert fields.skills == ["Python"]
    assert extract_fields(extract_text("resume.pdf", render_pdf(fields))) == fields


@pytest.mark.parametrize("encrypted,pages", [(True, 1), (False, 21), (False, 1)])
def test_unsupported_pdfs(encrypted, pages):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(100, 100)
    if encrypted:
        writer.encrypt("password")
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(InvalidDocument):
        extract_text("resume.pdf", output.getvalue())


def test_broken_pdf_and_utf8_text():
    with pytest.raises(InvalidDocument):
        extract_text("broken.pdf", b"%PDF-1.7 this is corrupted")
    assert "Alex" in extract_text(
        "resume.txt", b"\xef\xbb\xbfAlex\nPython developer with 3 years of experience"
    )


def test_gemini_is_optional_and_validates_output():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, provider="gemini")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, provider="gemini", gemini_api_key="test", gemini_model="../bad")
    settings = Settings(
        _env_file=None, provider="gemini", gemini_api_key="test", gemini_model="test-model"
    )
    captured = []

    def handler(request):
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": '{"suggestions":[{"title":"Show impact","detail":"Describe your actual contribution.","kind":"improvement"}]}'
                                }
                            ]
                        }
                    }
                ]
            },
        )

    fields = ResumeFields(full_name="Alex", skills=["Python"])
    result = Reviewer(settings, httpx.MockTransport(handler)).analyze(fields, "Python and Docker")
    assert result.provider == "gemini"
    assert result.suggestions[0].title == "Show impact"
    assert asdict(fields)["skills"] == ["Python"]
    assert captured[0].headers["x-goog-api-key"] == "test"
    assert "key=" not in str(captured[0].url)


@pytest.mark.parametrize(
    "status,payload",
    [
        (429, {}),
        (200, {}),
        (200, {"candidates": []}),
        (200, {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]}),
    ],
)
def test_provider_failures_are_explicit(status, payload):
    settings = Settings(
        _env_file=None, provider="gemini", gemini_api_key="test", gemini_model="test-model"
    )
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json=payload))
    with pytest.raises(ProviderUnavailable):
        Reviewer(settings, transport).analyze(ResumeFields(), "A Python developer role")


def test_skills_validation_and_deduplication():
    assert FieldsSchema(skills=[" Python ", "python"]).skills == ["Python"]
    with pytest.raises(ValidationError):
        FieldsSchema(skills=[""])
    with pytest.raises(ValidationError):
        FieldsSchema(skills=["x" * 81])


@pytest.mark.parametrize(
    "setting,value",
    [
        ("database_url", "sqlite:///example.db"),
        ("redis_url", "memory://"),
    ],
)
def test_external_storage_is_required(setting, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{setting: value})
