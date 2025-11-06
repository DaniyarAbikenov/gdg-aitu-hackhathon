import json
import time
import uuid
import mimetypes

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth, firestore
from google.cloud import storage

from app.schemas.gemini_schemas import ImprovementsResponse
from app.schemas.resume import AnalyzeRequest
from app.services.firestore_service import set_doc, get_doc, update_doc
from app.services.gcs_service import generate_signed_url, upload_bytes_to_gcs
from app.services.geminit_service import (
    gemini_extract_resume_fields_from_pdf,
    gemini_analyze_resume,
    gemini_generate_html
)
from app.config import settings
# from app.services.html_to_pdf import generate_pdf_from_html

router = APIRouter(prefix="/resume", tags=["Resume"])
security = HTTPBearer()


# ============================================================
# ✅ AUTH: Extract UID
# ============================================================
def get_uid(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ============================================================
# ✅ Upload file to GCS
# ============================================================
def upload_to_gcs(file: UploadFile, uid: str) -> str:
    client = storage.Client()
    bucket = client.bucket(settings.GCS_BUCKET)

    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    object_name = f"resumes/{uid}/{int(time.time())}_{uuid.uuid4().hex}{ext}"

    blob = bucket.blob(object_name)
    blob.upload_from_file(file.file, content_type=file.content_type)
    # blob.make_private()

    return f"gs://{settings.GCS_BUCKET}/{object_name}"


# ============================================================
# ✅ 1. UPLOAD RESUME
# ============================================================
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


# ============================================================
# ✅ 2. EXTRACT RESUME FIELDS (Gemini PDF parser)
# ============================================================
@router.post("/{resume_id}/extract")
async def extract_resume(resume_id: str, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    gs_url = doc.get("gs_url")
    if not gs_url:
        raise HTTPException(400, "No gs_url found in resume record")

    fields = gemini_extract_resume_fields_from_pdf(gs_url)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_extracted": fields,
        "fields_final": fields,
        "status": "extracted"
    })

    return {"fields": fields}


# ============================================================
# ✅ 3. SAVE USER-EDITED FIELDS
# ============================================================
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


# ============================================================
# ✅ 4. IMPROVE RESUME BASED ON JOB DESCRIPTION
# ============================================================
@router.post("/{resume_id}/improve")
async def improve_resume(resume_id: str, req: AnalyzeRequest, uid: str = Depends(get_uid)):
    print(f"Starting improvement process for resume: {resume_id}")

    # Получаем данные о резюме из базы данных
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        print(f"Resume {resume_id} not found.")
        raise HTTPException(404, "Resume not found")

    print(f"Found resume {resume_id}. Extracting fields...")
    fields = doc.get("fields_final", {})
    if not fields:
        print(f"No final fields found for resume {resume_id}")
        raise HTTPException(400, "No fields available to improve")

    # Получаем профиль пользователя
    print(f"Fetching user profile for user {uid}...")
    user_profile = get_doc("users", uid) or {}
    print(f"User profile fetched for {uid}: {user_profile}")

    # Вызов функции для анализа и улучшения резюме
    print("Calling Gemini to analyze and improve resume fields...")
    improvements = doc.get("improvements", [])
    print(f"Found {len(improvements)} improvements")
    if not improvements:
        print("No improvements found. Generating new fields...")
        improvements = gemini_analyze_resume(
            fields,
            req.jd_text,
            user_profile=user_profile
        )

    # Обновляем документ в базе с улучшениями
    print(f"Updating resume {resume_id} with improvements...")
    update_doc(f"resumes/{uid}/items", resume_id, {
        "improvements": improvements,
        # "resume_draft": resume_draft,
        "jd_text": req.jd_text,
        "status": "improved"
    })
    print(f"Resume {resume_id} updated successfully.")

    # Возвращаем результаты
    return {
        "improvements": improvements or [],
        # "draft": resume_draft
    }


# ============================================================
# ✅ 5. GENERATE PDF FROM TEMPLATE
# ============================================================
# 1. Генерация PDF
@router.post("/{resume_id}/generate")
async def generate_resume(resume_id: str, req: AnalyzeRequest, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc.get("fields_final")
    if not fields:
        raise HTTPException(400, "No fields to generate")

    # Текст вакансии из запроса
    jd_text = req.jd_text

    # Загрузка HTML шаблона (используем файл шаблона modern_resume2.html)
    try:
        with open("app/templates/modern_resume2.html") as f:
            template_html = f.read()
    except FileNotFoundError:
        raise HTTPException(500, "Template file not found")

    # Заполнение HTML с контентом
    improvements = doc.get("improvements", [])

    html_filled = gemini_generate_html(fields, improvements)


    # Загружаем результат в GCS
    output_gcs = f"resumes/{uid}/generated/{resume_id}.html"
    bucket = storage.Client().bucket(settings.GCS_BUCKET)
    blob = bucket.blob(output_gcs)

    try:
        blob.upload_from_string(html_filled, content_type="text/html")
        # blob.make_private()
    except Exception as e:
        raise HTTPException(500, f"GCS upload error: {e}")

    gcs_path = f"resumes/{uid}/generated/{resume_id}.html"

    # Генерируем подписанный URL для доступа
    pdf_url = generate_signed_url(gcs_path)

    # Обновляем запись в Firestore с новым URL и статусом
    update_doc(f"resumes/{uid}/items", resume_id, {
        "generated_url": pdf_url,
        "template_used": "modern_resume2.html",  # используем имя шаблона
        "html_resume": html_filled,
        "status": "generated"
    })

    return {"pdf_url": pdf_url}




# ============================================================
# ✅ 6. GET RESUME (for UI)
# ============================================================
@router.get("/{resume_id}")
async def get_resume(resume_id: str, uid: str = Depends(get_uid)):

    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    # Поля уже извлечены?
    if "fields_final" in doc:
        return {
            "resume_id": resume_id,
            "gs_url": doc.get("gs_url"),
            "fields": doc["fields_final"],
            "status": doc.get("status"),
            "improvements": doc.get("improvements"),
            "generated_url": doc.get("generated_url")
        }

    # Иначе извлекаем заново
    gs_url = doc.get("gs_url")
    if not gs_url:
        raise HTTPException(400, "gs_url missing")

    fields = gemini_extract_resume_fields_from_pdf(gs_url)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_extracted": fields,
        "fields_final": fields,
        "status": "extracted"
    })

    return {
        "resume_id": resume_id,
        "gs_url": gs_url,
        "fields": fields,
        "status": "extracted"
    }
