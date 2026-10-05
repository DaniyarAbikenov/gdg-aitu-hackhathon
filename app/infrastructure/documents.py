"""Bounded text extraction and deterministic PDF rendering."""

import io
from dataclasses import asdict
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile

from docx import Document
from pydantic import BaseModel, Field, model_validator
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
from app.domain.periods import validate_history
from app.domain.review import extract_fields
from app.infrastructure.ai import structured_ai


def extract_text(filename, data):
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise InvalidDocument("Use a UTF-8 text file or a text-based PDF.") from exc
    elif suffix == ".docx":
        try:
            with ZipFile(io.BytesIO(data)) as archive:
                if (
                    sum(i.file_size for i in archive.infolist()) > 30_000_000
                    or len(archive.infolist()) > 1000
                ):
                    raise InvalidDocument("The Word document is too large when unpacked.")
            document = Document(io.BytesIO(data))
            text = "\n".join(
                [p.text for p in document.paragraphs]
                + [
                    " | ".join(c.text for c in row.cells)
                    for table in document.tables
                    for row in table.rows
                ]
            )
        except InvalidDocument:
            raise
        except Exception as exc:
            raise InvalidDocument("Use a valid .docx document.") from exc
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


def resume_sections(fields):
    """Readable, ordered blocks shared by PDF and Word (never dictionary dumps)."""
    sections = []
    for title, key in [
        ("Profile", "summary"),
        ("Skills", "skills"),
        ("Experience", "experience"),
        ("Education", "education"),
        ("Projects", "projects"),
        ("Certificates", "certificates"),
        ("Languages", "languages"),
    ]:
        value = getattr(fields, key)
        if not value:
            continue
        blocks = []
        if key == "skills":
            blocks = [" · ".join(value)]
        elif isinstance(value, str):
            blocks = [line for line in value.splitlines() if line.strip()]
        else:
            for entry in value:
                if key == "experience":
                    lines = [
                        " · ".join(v for v in [entry.get("role"), entry.get("company")] if v),
                        " · ".join(
                            v
                            for v in [
                                " — ".join(
                                    str(v)
                                    for v in [entry.get("date_from"), entry.get("date_to")]
                                    if v
                                ),
                                entry.get("location"),
                            ]
                            if v
                        ),
                        entry.get("responsibilities", ""),
                        *["• " + item for item in entry.get("achievements", [])],
                    ]
                elif key == "education":
                    lines = [
                        " · ".join(v for v in [entry.get("degree"), entry.get("institution")] if v),
                        " — ".join(
                            str(v) for v in [entry.get("year_start"), entry.get("year_end")] if v
                        ),
                    ]
                else:
                    lines = [
                        entry.get("title", ""),
                        entry.get("description", ""),
                        " · ".join(entry.get("tech", [])),
                    ]
                blocks.append("\n".join(line for line in lines if line))
        sections.append((title, blocks))
    return sections


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
    if fields.position:
        story.append(paragraph(fields.position, "CareerSection"))
    if fields.email:
        story.append(paragraph(fields.email))
    contact = " · ".join(v for v in [fields.phone, fields.location] if v)
    if contact:
        story.append(paragraph(contact))
    for title, blocks in resume_sections(fields):
        story.append(paragraph(title, "CareerSection"))
        for block in blocks:
            for line in block.splitlines():
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
    position: str = Field(default="", max_length=200)
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

    @model_validator(mode="after")
    def validate_dates(self):
        validate_history(self.model_dump())
        return self


class ComposedResume(BaseModel):
    fields: ExtractedResume
    questions: list[str] = Field(max_length=6)


class Documents:
    def __init__(self, settings=None, transport=None):
        self.settings = settings
        self.ai = structured_ai(settings, transport) if settings else None

    def extract(self, filename, data):
        if self.settings and self.settings.provider == "unconfigured":
            from app.domain.errors import ProviderUnavailable

            raise ProviderUnavailable
        if self.settings and self.settings.provider in {"gemini", "openai"}:
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
                "Extract the actual resume facts. Preserve all experience, education, projects, contact details and certificates. Use structured entries for experience, education and projects. For work dates return YYYY-MM when a month is stated, YYYY when only a year is stated, and present for an explicitly ongoing role. Never invent a month or a day. Use zero for unknown education years and empty strings for unknown work dates. Do not infer or invent missing facts. Empty fields are allowed.",
                source,
                ExtractedResume,
                document=data if pdf else None,
            )
            return ResumeFields(**fields)
        return extract_fields(extract_text(filename, data))

    def compose(self, fields, position, job, facts):
        if not self.settings or self.settings.provider == "unconfigured":
            from app.domain.errors import ProviderUnavailable

            raise ProviderUnavailable
        if self.settings.provider == "local":
            return {"fields": asdict(ResumeFields(**fields)), "questions": []}
        return self.ai.generate(
            "Compose a factual resume for the target position using ONLY selected profile blocks and confirmed additional facts. "
            "Use exact experience, tasks, achievements, location and periods. Preserve contact details. "
            "Never invent skills or numeric impact. If the evidence is insufficient ask up to six concrete clarifying questions; "
            "otherwise questions must be empty. Tailor wording and order to the vacancy without changing facts.",
            {"profile": fields, "position": position, "job": job, "confirmed_facts": facts},
            ComposedResume,
        )

    def docx(self, fields):
        document = Document()
        document.add_heading(fields.full_name or "Resume", 0)
        if fields.position:
            document.add_paragraph(fields.position, style="Subtitle")
        document.add_paragraph(
            " · ".join(v for v in [fields.email, fields.phone, fields.location] if v)
        )
        from docx.shared import Inches, Pt

        section = document.sections[0]
        section.top_margin = section.bottom_margin = Inches(0.65)
        section.left_margin = section.right_margin = Inches(0.7)
        normal = document.styles["Normal"]
        normal.font.name = "Calibri"
        normal.font.size = Pt(11)
        normal.paragraph_format.space_after = Pt(6)
        for title, blocks in resume_sections(fields):
            document.add_heading(title, 1)
            for block in blocks:
                document.add_paragraph(block)
        output = io.BytesIO()
        document.save(output)
        return output.getvalue()

    def pdf(self, fields, template="modern"):
        return render_pdf(fields, template)
