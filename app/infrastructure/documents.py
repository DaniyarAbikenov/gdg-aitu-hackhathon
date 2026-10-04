"""Bounded text extraction and deterministic PDF rendering."""

import io
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.domain.errors import InvalidDocument
from app.domain.review import extract_fields


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


def render_pdf(fields):
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
            fontSize=24,
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
            textColor=colors.HexColor("#08766f"),
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


class Documents:
    def extract(self, filename, data):
        return extract_fields(extract_text(filename, data))

    def pdf(self, fields):
        return render_pdf(fields)
