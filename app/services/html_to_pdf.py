import json
import pdfkit
from fastapi import APIRouter, HTTPException, Depends
from google.cloud import storage

from app.routers.user import get_uid
from app.services.firestore_service import update_doc, get_doc
from app.services.gcs_service import generate_signed_url, upload_bytes_to_gcs
from app.config import settings
from app.services.geminit_service import gemini_generate_html

router = APIRouter(prefix="/resume", tags=["Resume"])


# Функция для генерации PDF из HTML
def generate_pdf_from_html(html: str) -> bytes:
    try:
        # Генерация PDF
        pdf = pdfkit.from_string(html, False)
        return pdf
    except Exception as e:
        raise HTTPException(500, f"Error generating PDF: {e}")


# Генерация резюме в PDF
@router.post("/{resume_id}/generate")
async def generate_resume(resume_id: str, template: str, uid: str = Depends(get_uid)):
    # Получаем данные из базы
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc.get("fields_final")
    improvements = doc.get("improvements", [])
    jd_text = doc.get("jd_text", "")
    skills = doc.get("skills", [])

    if not fields:
        raise HTTPException(400, "No fields to generate resume")

    # Загрузим HTML шаблон и заполним его данными

    # Заполнение шаблона данными
    filled_html = gemini_generate_html(fields, improvements)

    # Добавим улучшения, навыки и описание вакансии в шаблон
    improvements_html = ""
    for improvement in improvements[:10]:  # Ограничиваем до 10 улучшений
        improvements_html += f"<li>{improvement['description']}</li>"

    skills_html = "".join([f'<span class="skill-badge">{skill}</span>' for skill in skills])

    final_html = filled_html.replace("[IMPROVEMENTS_HTML]", improvements_html).replace("[SKILLS_HTML]",
                                                                                       skills_html).replace("[JD_TEXT]",
                                                                                                            jd_text)

    # Генерация PDF
    pdf_bytes = generate_pdf_from_html(final_html)

    # Загрузим PDF в GCS
    gcs_path = f"resumes/{uid}/generated/{resume_id}.pdf"
    upload_bytes_to_gcs(gcs_path, pdf_bytes)

    # Генерация подписанного URL для скачивания
    pdf_url = generate_signed_url(gcs_path)

    # Сохранение PDF URL в базе данных
    update_doc(f"resumes/{uid}/items", resume_id, {
        "generated_url": pdf_url,
        "status": "generated"
    })

    return {"pdf_url": pdf_url}
