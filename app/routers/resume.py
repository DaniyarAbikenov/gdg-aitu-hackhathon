import json
import time
import uuid
import mimetypes

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth, firestore
from google.cloud import storage

from app.schemas.gemini_schemas import ImprovementsResponse
from app.services.firestore_service import set_doc, get_doc, update_doc
from app.services.gcs_service import generate_signed_url
from app.services.geminit_service import (
    gemini_extract_resume_fields_from_pdf,
    gemini_analyze_resume,
    gemini_generate_html
)
from app.services.html_to_pdf import html_to_pdf
from app.schemas.resume import AnalyzeRequest

from app.config import settings

router = APIRouter(prefix="/resume", tags=["Resume"])
security = HTTPBearer()


# ---------------------------------------------------------
# Extract UID
# ---------------------------------------------------------
def get_uid(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ---------------------------------------------------------
# Upload to GCS
# ---------------------------------------------------------
def upload_to_gcs(file: UploadFile, uid: str) -> str:
    client = storage.Client()
    bucket = client.bucket(settings.GCS_BUCKET)

    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    object_name = f"resumes/{uid}/{int(time.time())}_{uuid.uuid4().hex}{ext}"

    blob = bucket.blob(object_name)
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_private()

    return f"gs://{settings.GCS_BUCKET}/{object_name}"


# ---------------------------------------------------------
# ✅ 1. UPLOAD RESUME (PDF)
# ---------------------------------------------------------
@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), uid: str = Depends(get_uid)):
    gcs_url = upload_to_gcs(file, uid)

    resume_id = str(uuid.uuid4())
    set_doc(f"resumes/{uid}/items", resume_id, {
        "gs_url": gcs_url,
        "created_at": firestore.SERVER_TIMESTAMP,
        "status": "uploaded"
    })

    return {"resume_id": resume_id, "gs_url": gcs_url}


# ---------------------------------------------------------
# ✅ 2. EXTRACT FIELDS USING GEMINI
# ---------------------------------------------------------
@router.post("/{resume_id}/extract")
async def extract_resume(resume_id: str, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    gcs_path = doc["gs_url"]

    # ✅ Gemini parses PDF
    fields = gemini_extract_resume_fields_from_pdf(gcs_path)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_extracted": fields,
        "fields_final": fields,  # start editable copy
        "status": "extracted"
    })

    return {"fields": fields}


# ---------------------------------------------------------
# ✅ 3. SAVE MODIFIED FIELDS AFTER USER EDITING
# ---------------------------------------------------------
@router.post("/{resume_id}/save")
async def save_resume_fields(resume_id: str, payload: dict, uid: str = Depends(get_uid)):
    fields = payload.get("fields")
    if not fields:
        raise HTTPException(400, "Missing 'fields'")

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_final": fields,
        "status": "edited"
    })

    return {"status": "ok"}


# ---------------------------------------------------------
# ✅ 4. IMPROVE RESUME BASED ON JD USING GEMINI
# ---------------------------------------------------------
@router.post("/{resume_id}/improve")
async def improve_resume(resume_id: str, req: AnalyzeRequest, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc.get("fields_final", {})

    improvements, resume_draft = gemini_analyze_resume(
        fields,
        req.jd_text,
        user_profile=get_doc("users", uid)
    )

    update_doc(f"resumes/{uid}/items", resume_id, {
        "improvements": improvements,
        "resume_draft": resume_draft,
        "jd_text": req.jd_text,
        "status": "improved"
    })

    return {
        "improvements": improvements,
        "draft": resume_draft
    }


# ---------------------------------------------------------
# ✅ 5. GENERATE FINAL PDF FROM HTML TEMPLATE
# ---------------------------------------------------------
@router.post("/{resume_id}/generate")
async def generate_resume(resume_id: str, template: str, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc.get("fields_final")
    if not fields:
        raise HTTPException(400, "No fields to generate")

    # Load HTML template
    template_html = open(f"templates/resume_{template}.html").read()

    # Gemini fills HTML with content
    html_filled = gemini_generate_html(fields, template_html)

    # Convert to PDF
    pdf_bytes = html_to_pdf(html_filled)

    # Upload result
    output_gcs = f"resumes/{uid}/generated/{resume_id}.pdf"
    bucket = storage.Client().bucket(settings.GCS_BUCKET)
    blob = bucket.blob(output_gcs)
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")
    blob.make_private()

    download_url = generate_signed_url(output_gcs)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "generated_url": download_url,
        "template_used": template,
        "html_resume": html_filled,
        "status": "generated"
    })

    return {"pdf_url": download_url}


# ---------------------------------------------------------
# ✅ 6. GET RESUME (FOR EDIT PAGE)
# ---------------------------------------------------------
@router.get("/{resume_id}")
async def get_resume(resume_id: str, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    # Если поля уже извлечены — вернуть как есть
    if "fields" in doc and doc["fields"]:
        return doc

    # Иначе — извлечь из PDF и обновить запись
    gcs_path = doc.get("gs_url")
    if not gcs_path:
        raise HTTPException(400, "Missing gs_url in resume document")

    from app.services.geminit_service import gemini_extract_resume_fields_from_pdf
    fields = gemini_extract_resume_fields_from_pdf(gcs_path)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields": fields,
        "status": "extracted"
    })

    return {
        "resume_id": resume_id,
        "fields": fields,
        "status": "extracted",
        "gs_url": gcs_path
    }


@router.post("/{resume_id}/improve")
async def improve_resume(
        resume_id: str,
        body: dict,
        uid: str = Depends(get_uid)
):
    jd_text = body.get("jd_text")
    if not jd_text:
        raise HTTPException(400, "jd_text is required")

    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc["fields"]
    user_profile = get_doc("users", uid) or {}

    from google import genai
    client = genai.Client(
        vertexai=True,
        project="gdg-hackathon-aitu",
        location="us-central1"
    )

    prompt = f"""
Ты — профессиональная система адаптации резюме.

На основе трех источников:
1) Профиль пользователя
2) Текст вакансии
3) Извлечённые поля резюме

Сгенерируй улучшения по секциям (summary, skills, experience, education, projects).

Каждое улучшение — атомарное действие: переписать summary, добавить навыки, уточнить опыт и т.д.
"""

    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents=[
            prompt,
            {"text": "PROFILE:\n" + json.dumps(user_profile, ensure_ascii=False)},
            {"text": "RESUME FIELDS:\n" + json.dumps(fields, ensure_ascii=False)},
            {"text": "JOB DESCRIPTION:\n" + jd_text},
        ],
        config={
            "response_mime_type": "application/json",
            "response_schema": ImprovementsResponse,
        }
    )

    improvements = response.parsed.dict()

    update_doc(f"resumes/{uid}/items", resume_id, {
        "jd_text": jd_text,
        "improvements": improvements,
        "status": "improved"
    })

    return improvements
