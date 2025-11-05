import datetime

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.api_core.client_options import ClientOptions
from google.cloud import storage, documentai_v1 as documentai
from firebase_admin import auth as firebase_auth, firestore
import uuid
import time
import mimetypes

from app.schemas.resume import AnalyzeRequest, ApplyChangesRequest
from app.services.docai_service import docai_extract_text
from app.services.firestore_service import set_doc, get_doc, update_doc
from app.firebase import verify_token
from app.config import settings
from app.services.gcs_service import generate_signed_url
from app.services.geminit_service import gemini_analyze_resume, gemini_extract_resume_fields, gemini_generate_html
from app.services.html_to_pdf import html_to_pdf

router = APIRouter(prefix="/resume", tags=["Resume"])
security = HTTPBearer()

# -----------------------------
# Helper: get UID from Bearer
# -----------------------------
def get_uid(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# -----------------------------
# Google Cloud Storage upload
# -----------------------------
def upload_to_gcs(file: UploadFile, uid: str) -> str:
    client = storage.Client()
    bucket = client.bucket(settings.GCS_BUCKET)

    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    object_name = f"resumes/{uid}/{int(time.time())}_{uuid.uuid4().hex}{ext}"

    blob = bucket.blob(object_name)
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_private()

    return f"gs://{settings.GCS_BUCKET}/{object_name}"


# -----------------------------
# Document AI parsing
# -----------------------------
def process_with_docai(gcs_uri: str):
    client = documentai.DocumentProcessorServiceClient(
        client_options=ClientOptions(api_endpoint="us-documentai.googleapis.com")
    )

    name = client.processor_path(
        "56998693149",
        "us",
        settings.DOC_AI_PROCESSOR_ID,
    )

    request = documentai.ProcessRequest(
        name=name,
        gcs_document=documentai.GcsDocument(
            gcs_uri=gcs_uri,
            mime_type="application/pdf"  # docx можно тоже пропустить, процессор сам определит
        ),
    )

    result = client.process_document(request=request)
    return result.document


# -----------------------------
# Main endpoint
# -----------------------------
@router.post("/parse-and-tune")
async def parse_and_tune_resume(
    file: UploadFile = File(...),
    companyUrl: str = Form(...),
    jdText: str = Form(...),
    uid: str = Depends(get_uid)
):
    """
    1) Загружает файл резюме в GCS
    2) Запускает Document AI Resume Parser
    3) Возвращает распарсенные поля + echo-входа
    """
    if not file:
        raise HTTPException(status_code=400, detail="File not provided")

    gcs_url = upload_to_gcs(file, uid)

    try:
        doc = process_with_docai(gcs_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DocAI error: {e}")

    # -----------------------------
    # Extract ROUGH Resume data
    # -----------------------------
    extracted_fields = {}

    for ent in doc.entities:
        key = ent.type_
        value = ent.mention_text
        extracted_fields[key] = value

    # Можно сохранить это в Firestore
    resume_id = f"r_{uuid.uuid4().hex[:8]}"

    resume_record = {
        "fileUrl": gcs_url,
        "fields": extracted_fields,
        "companyUrl": companyUrl,
        "jdText": jdText,
        "createdAt": int(time.time()),
    }

    set_doc(f"resumes/{uid}/items", resume_id, resume_record)

    return {
        "resumeId": resume_id,
        "fileUrl": gcs_url,
        "fields": extracted_fields,
        "companyUrl": companyUrl,
        "jdText": jdText,
        "status": "parsed"
    }

# New way

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    uid: str = Depends(get_uid)
):
    # ✅ загружаем напрямую UploadFile
    gcs_url = upload_to_gcs(file, uid)

    # ✅ сохраняем метаданные
    resume_id = str(uuid.uuid4())
    record = {
        "gs_url": gcs_url,
        "created_at": firestore.SERVER_TIMESTAMP
    }

    set_doc(f"resumes/{uid}/items", resume_id, record)

    return {"resume_id": resume_id, "gs_url": gcs_url}


@router.post("/{resume_id}/parse")
async def parse_resume(
    resume_id: str,
    uid: str = Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    gcs_path = doc["gcs_path"]

    # ✅ OCR (Document AI)
    text = docai_extract_text(gcs_path)

    # ✅ первичный парсинг (Gemini)
    fields = gemini_extract_resume_fields(text)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "raw_text": text,
        "fields_extracted": fields,
        "fields_verified": fields,
        "status": "parsed"
    })

    return {"fields": fields}

@router.post("/{resume_id}/verify")
async def verify_resume_fields(
    resume_id: str,
    payload: dict,
    uid: str = Depends(get_uid)
):
    fields = payload.get("fields_verified")
    if not fields:
        raise HTTPException(400, "fields_verified required")

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_verified": fields,
        "status": "verified"
    })

    return {"status": "ok"}

import datetime

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.cloud import storage, documentai_v1 as documentai
from firebase_admin import auth as firebase_auth, firestore
import uuid
import time
import mimetypes

from app.schemas.resume import AnalyzeRequest, ApplyChangesRequest
from app.services.docai_service import docai_extract_text
from app.services.firestore_service import set_doc, get_doc, update_doc
from app.firebase import verify_token
from app.config import settings
from app.services.gcs_service import generate_signed_url
from app.services.geminit_service import gemini_analyze_resume, gemini_extract_resume_fields, gemini_generate_html
from app.services.html_to_pdf import html_to_pdf

router = APIRouter(prefix="/resume", tags=["Resume"])
security = HTTPBearer()

# -----------------------------
# Helper: get UID from Bearer
# -----------------------------
def get_uid(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# -----------------------------
# Google Cloud Storage upload
# -----------------------------
def upload_to_gcs(file: UploadFile, uid: str) -> str:
    client = storage.Client()
    bucket = client.bucket(settings.GCS_BUCKET)

    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    object_name = f"resumes/{uid}/{int(time.time())}_{uuid.uuid4().hex}{ext}"

    blob = bucket.blob(object_name)
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_private()

    return f"gs://{settings.GCS_BUCKET}/{object_name}"


# -----------------------------
# Document AI parsing
# -----------------------------
# def process_with_docai(gcs_uri: str):
#     client = documentai.DocumentProcessorServiceClient()
#
#     name = client.processor_path(
#         "56998693149",
#         "us",
#         settings.DOC_AI_PROCESSOR_ID,
#     )
#
#     request = documentai.ProcessRequest(
#         name=name,
#         gcs_document=documentai.GcsDocument(
#             gcs_uri=gcs_uri,
#             mime_type="application/pdf"  # docx можно тоже пропустить, процессор сам определит
#         ),
#     )
#
#     result = client.process_document(request=request)
#     return result.document


# -----------------------------
# Main endpoint
# -----------------------------
@router.post("/parse-and-tune")
async def parse_and_tune_resume(
    file: UploadFile = File(...),
    companyUrl: str = Form(...),
    jdText: str = Form(...),
    uid: str = Depends(get_uid)
):
    """
    1) Загружает файл резюме в GCS
    2) Запускает Document AI Resume Parser
    3) Возвращает распарсенные поля + echo-входа
    """
    if not file:
        raise HTTPException(status_code=400, detail="File not provided")

    gcs_url = upload_to_gcs(file, uid)

    try:
        doc = process_with_docai(gcs_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DocAI error: {e}")

    # -----------------------------
    # Extract ROUGH Resume data
    # -----------------------------
    extracted_fields = {}

    for ent in doc.entities:
        key = ent.type_
        value = ent.mention_text
        extracted_fields[key] = value

    # Можно сохранить это в Firestore
    resume_id = f"r_{uuid.uuid4().hex[:8]}"

    resume_record = {
        "fileUrl": gcs_url,
        "fields": extracted_fields,
        "companyUrl": companyUrl,
        "jdText": jdText,
        "createdAt": int(time.time()),
    }

    set_doc(f"resumes/{uid}/items", resume_id, resume_record)

    return {
        "resumeId": resume_id,
        "fileUrl": gcs_url,
        "fields": extracted_fields,
        "companyUrl": companyUrl,
        "jdText": jdText,
        "status": "parsed"
    }

# New way

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    uid: str = Depends(get_uid)
):
    # ✅ загружаем напрямую UploadFile
    gcs_url = upload_to_gcs(file, uid)

    # ✅ сохраняем метаданные
    resume_id = str(uuid.uuid4())
    record = {
        "gs_url": gcs_url,
        "created_at": firestore.SERVER_TIMESTAMP
    }

    set_doc(f"resumes/{uid}/items", resume_id, record)

    return {"resume_id": resume_id, "gs_url": gcs_url}


@router.post("/{resume_id}/parse")
async def parse_resume(
    resume_id: str,
    uid: str = Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    gcs_path = doc["gs_url"]

    # ✅ OCR (Document AI)
    text = docai_extract_text(gcs_path)

    # ✅ первичный парсинг (Gemini)
    fields = gemini_extract_resume_fields(text)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "raw_text": text,
        "fields_extracted": fields,
        "fields_verified": fields,
        "status": "parsed"
    })

    return {"fields": fields}

@router.post("/{resume_id}/verify")
async def verify_resume_fields(
    resume_id: str,
    payload: dict,
    uid: str = Depends(get_uid)
):
    fields = payload.get("fields_verified")
    if not fields:
        raise HTTPException(400, "fields_verified required")

    update_doc(f"resumes/{uid}/items", resume_id, {
        "fields_verified": fields,
        "status": "verified"
    })

    return {"status": "ok"}


@router.post("/{resume_id}/analyze")
async def analyze_resume(
    resume_id: str,
    req: AnalyzeRequest,
    uid: str = Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields_verified = doc["fields_verified"]

    # ✅ Gemini анализ
    improvements, resume_draft = gemini_analyze_resume(
        fields_verified,
        req.jd_text,
        user_profile=get_doc("users", uid)
    )

    update_doc(f"resumes/{uid}/items", resume_id, {
        "jd_text": req.jd_text,
        "improvements": improvements,
        "draft_resume": resume_draft,
        "status": "analyzed"
    })

    return {
        "improvements": improvements,
        "draftResume": resume_draft
    }

@router.get("/{resume_id}")
async def get_resume(resume_id: str, uid: str = Depends(get_uid)):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")
    return doc


@router.post("/{resume_id}/generate")
async def generate_resume(
    resume_id: str,
    template: str,  # "modern" | "classic" | "minimalist"
    uid=Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc["fields_final"]

    template_html = open(f"templates/resume_{template}.html").read()

    # 1. Gemini → filled HTML
    html = gemini_generate_html(fields, template_html)

    # 2. HTML → PDF
    pdf_bytes = html_to_pdf(html)

    # 3. Store
    gcs_path = f"resumes/{uid}/generated/{resume_id}.pdf"
    upload_to_gcs(gcs_path, pdf_bytes)
    pdf_url = generate_signed_url(gcs_path)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "html_resume": html,
        "generated_url": pdf_url,
        "template_used": template
    })

    return {"pdf_url": pdf_url}



@router.post("/{resume_id}/analyze")
async def analyze_resume(
    resume_id: str,
    req: AnalyzeRequest,
    uid: str = Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields_verified = doc["fields_verified"]

    # ✅ Gemini анализ
    improvements, resume_draft = gemini_analyze_resume(
        fields_verified,
        req.jd_text,
        user_profile=get_doc("users", uid)
    )

    update_doc(f"resumes/{uid}/items", resume_id, {
        "jd_text": req.jd_text,
        "improvements": improvements,
        "draft_resume": resume_draft,
        "status": "analyzed"
    })

    return {
        "improvements": improvements,
        "draftResume": resume_draft
    }



@router.post("/{resume_id}/generate")
async def generate_resume(
    resume_id: str,
    template: str,  # "modern" | "classic" | "minimalist"
    uid=Depends(get_uid)
):
    doc = get_doc(f"resumes/{uid}/items", resume_id)
    if not doc:
        raise HTTPException(404, "Resume not found")

    fields = doc["fields_final"]

    template_html = open(f"templates/resume_{template}.html").read()

    # 1. Gemini → filled HTML
    html = gemini_generate_html(fields, template_html)

    # 2. HTML → PDF
    pdf_bytes = html_to_pdf(html)

    # 3. Store
    gcs_path = f"resumes/{uid}/generated/{resume_id}.pdf"
    upload_to_gcs(gcs_path, pdf_bytes)
    pdf_url = generate_signed_url(gcs_path)

    update_doc(f"resumes/{uid}/items", resume_id, {
        "html_resume": html,
        "generated_url": pdf_url,
        "template_used": template
    })

    return {"pdf_url": pdf_url}

