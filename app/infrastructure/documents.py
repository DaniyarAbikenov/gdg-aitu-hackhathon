"""Bounded text extraction and deterministic PDF rendering."""

import io
from pathlib import Path
from xml.sax.saxutils import escape

from pydantic import BaseModel, Field
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.contracts import Education, Experience, Project
from app.domain.errors import InvalidDocument
from app.domain.models import ResumeFields
from app.domain.review import extract_fields
from app.infrastructure.coach import GeminiJSON


def extract_text(filename, data):
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise InvalidDocument("Use a UTF-8 text file or a text-based PDF.") from exc
    elif suffix == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise InvalidDocument("This file is not a valid PDF.")
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise InvalidDocument("Remove the PDF password before uploading.")
            if len(reader.pages) > 20:
                raise InvalidDocument("Keep the resume to 20 pages or fewer.")
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except InvalidDocument:
            raise
        except Exception as exc:
            raise InvalidDocument("The PDF could not be read. Try exporting it again.") from exc
    else:
        raise InvalidDocument("Choose a .txt or .pdf resume.")
    text = text.replace("\x00", "").strip()
    if len(text) < 20:
        raise InvalidDocument("No readable resume text found. Scanned PDFs need OCR first.")
    if len(text) > 30000:
        raise InvalidDocument("Keep the resume under 30,000 characters.")
    return text


FONT_PATH = Path(__file__).parents[1] / "assets" / "NotoSans-Regular.ttf"
pdfmetrics.registerFont(TTFont("CareerSans", str(FONT_PATH)))


def render_pdf(fields, template="modern"):
    accent = {"modern": "#08766f", "classic": "#243943", "minimalist": "#333333"}[template]
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CareerBody",
            fontName="CareerSans",
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#243943"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CareerTitle",
            parent=styles["CareerBody"],
            fontSize=20 if template == "minimalist" else 24,
            leading=30,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CareerSection",
            parent=styles["CareerBody"],
            fontSize=12,
            leading=18,
            textColor=colors.HexColor(accent),
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=True,
        )
    )

    # Only reviewed fields are rendered. No model-generated HTML or external resources.
    def paragraph(value, style="CareerBody"):
        return Paragraph(escape(value).replace("\n", "<br/>"), styles[style])

    story = [paragraph(fields.full_name or "Resume", "CareerTitle")]
    if fields.email:
        story.append(paragraph(fields.email))
    contact = " · ".join(v for v in [fields.phone, fields.location] if v)
    if contact:
        story.append(paragraph(contact))
    sections = [
        ("Profile", fields.summary),
        ("Skills", " · ".join(fields.skills)),
        ("Experience & projects", fields.experience),
        ("Education", fields.education),
        ("Projects", fields.projects),
        ("Certificates", fields.certificates),
        ("Languages", fields.languages),
    ]
    for title, value in sections:
        if value:
            story.append(paragraph(title, "CareerSection"))
            # Split long user text into flowable paragraphs to allow page breaks.
            if isinstance(value, list):
                value = "\n\n".join(
                    "\n".join(
                        ", ".join(str(v) for v in item) if isinstance(item, list) else str(item)
                        for item in row.values()
                        if item
                    )
                    for row in value
                )
            for line in value.splitlines():
                if line.strip():
                    story.append(paragraph(line))
            story.append(Spacer(1, 3))
    doc = SimpleDocTemplate(
        output,
        pagesize=(8.27 * inch, 11.69 * inch),
        rightMargin=48,
        leftMargin=48,
        topMargin=45,
        bottomMargin=45,
        title="Resume — " + (fields.full_name or "Career Studio"),
        author=fields.full_name,
    )
    doc.build(story)
    return output.getvalue()


class ExtractedResume(BaseModel):
    full_name: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=3000)
    skills: list[str] = Field(default_factory=list, max_length=60)
    experience: list[Experience] = Field(default_factory=list, max_length=40)
    education: list[Education] = Field(default_factory=list, max_length=40)
    projects: list[Project] = Field(default_factory=list, max_length=40)
    certificates: str = Field(default="", max_length=3000)
    languages: str = Field(default="", max_length=500)


class Documents:
    def __init__(self, settings=None, transport=None):
        self.settings = settings
        self.ai = GeminiJSON(settings, transport) if settings else None

    def extract(self, filename, data):
        if self.settings and self.settings.provider == "gemini":
            pdf = Path(filename).suffix.lower() == ".pdf"
            if pdf:
                try:
                    reader = PdfReader(io.BytesIO(data))
                    if reader.is_encrypted or len(reader.pages) > 20:
                        raise InvalidDocument("Use an unencrypted PDF with 20 pages or fewer.")
                except InvalidDocument:
                    raise
                except Exception as exc:
                    raise InvalidDocument("The PDF could not be read.") from exc
                source = {"filename": filename}
            else:
                source = {"text": extract_text(filename, data)}
            fields = self.ai.generate(
                "Extract the actual resume facts. Preserve all experience, education, projects, contact details and certificates. Use structured entries for experience, education and projects. Use zero for unknown years and empty strings for unknown dates. Do not infer or invent missing facts. Empty fields are allowed.",
                source,
                ExtractedResume,
                document=data if pdf else None,
            )
            return ResumeFields(**fields)
        return extract_fields(extract_text(filename, data))

    def pdf(self, fields, template="modern"):
        return render_pdf(fields, template)
