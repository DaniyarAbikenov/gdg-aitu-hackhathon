from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def build_resume_pdf(fields: dict) -> bytes:
    buff = BytesIO()
    c = canvas.Canvas(buff, pagesize=A4)

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 800, fields.get("full_name", ""))

    c.setFont("Helvetica", 12)
    c.drawString(50, 780, fields.get("email", ""))
    c.drawString(50, 760, fields.get("phone", ""))

    # Summary
    c.drawString(50, 730, "Summary:")
    c.setFont("Helvetica", 11)
    y = 710
    for line in fields.get("summary", "").split("\n"):
        c.drawString(50, y, line)
        y -= 15

    # Skills
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Skills:")
    y -= 20
    c.setFont("Helvetica", 11)
    for s in fields.get("skills", []):
        c.drawString(60, y, f"- {s}")
        y -= 15

    c.showPage()
    c.save()

    return buff.getvalue()
