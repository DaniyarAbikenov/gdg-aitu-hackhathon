import base64
import json
from fastapi import HTTPException

from google import genai
from google.genai import types
from google.cloud import storage

from app.config import settings
from app.schemas.gemini_schemas import ResumeSchema

# ===========================================================
# ✅ Единый клиент Gemini Vertex AI
# ===========================================================
client = genai.Client(
    vertexai=True,
    project=settings.PROJECT_ID,     # "gdg-hackathon-aitu"
    location=settings.GCP_LOCATION   # "us-central1"
)

MODEL_NAME = settings.VERTEX_MODEL  # "gemini-1.5-flash"


# ===========================================================
# ✅ Универсальный вызов Gemini
# ===========================================================
def _gemini_call(prompt: str, parts: list = None, config=None) -> str:
    """
    Унифицированный вызов Gemini.
    `parts` — дополнительные данные (PDF, изображения и т.д.)
    """

    if config is None:
        config = {}
    contents = [prompt]
    if parts:
        contents.extend(parts)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=config,
        )
    except Exception as e:
        raise HTTPException(500, f"Gemini Vertex error: {e}")

    # Gemini может вернуть кандидатов или одиночный текст
    text = getattr(response, "text", None)

    if not text:
        raise HTTPException(500, f"Gemini returned empty response: {response}")

    return text


# ===========================================================
# ✅ Скачать PDF из Cloud Storage
# ===========================================================
def _download_pdf_from_gcs(gcs_path: str) -> bytes:
    if not gcs_path.startswith("gs://"):
        raise HTTPException(400, "Invalid GCS path")

    _, _, bucket_name, *blob_path = gcs_path.split("/", 3)
    blob_path = blob_path[0]

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    return blob.download_as_bytes()


# ===========================================================
# ✅ Текст → JSON полей резюме
# ===========================================================
def gemini_extract_resume_fields(text: str) -> dict:
    prompt = f"""
You are a resume extraction engine.

Extract structured resume fields from the text below
and return ONLY valid JSON with schema:

{{
  "full_name": "",
  "email": "",
  "phone": "",
  "summary": "",
  "skills": [],
  "education": [],
  "experience": []
}}

Resume text:
{text}
"""

    response = _gemini_call(prompt)

    try:
        return json.loads(response)
    except:
        raise HTTPException(500, "Invalid JSON from Gemini")


# ===========================================================
# ✅ PDF → JSON полей резюме
# ===========================================================
def gemini_extract_resume_fields_from_pdf(gcs_path: str) -> dict:
    pdf_bytes = _download_pdf_from_gcs(gcs_path)

    prompt = """
Ты — система для структурированной обработки резюме.
Извлеки из PDF следующую структуру (чистый JSON!):

{
  "summary": "",
  "skills": [],
  "experience": [
      {
         "position": "",
         "company": "",
         "start_date": "",
         "end_date": "",
         "description": ""
      }
  ],
  "education": [
      {
         "institution": "",
         "degree": "",
         "start_date": "",
         "end_date": ""
      }
  ],
  "projects": [
      {
         "name": "",
         "description": "",
         "technologies": []
      }
  ]
}

Если данных нет — возвращай пустые строки или пустые массивы.
"""

    response = _gemini_call(
        prompt,
        parts=[
            types.Part.from_bytes(
                mime_type="application/pdf",
                data=pdf_bytes
            )
        ],
        config={
        "response_mime_type": "application/json",
        "response_json_schema": ResumeSchema.model_json_schema(),
    },
    )

    try:
        return json.loads(response)
    except Exception:
        raise HTTPException(500, f"Gemini returned non-JSON: {response}")


# ===========================================================
# ✅ Анализ резюме vs JD
# ===========================================================
def gemini_analyze_resume(fields_verified: dict, jd_text: str, user_profile: dict):
    prompt = f"""
You are a professional resume analyst.

User profile:
{json.dumps(user_profile, ensure_ascii=False)}

Verified resume fields:
{json.dumps(fields_verified, ensure_ascii=False)}

Job description:
{jd_text}

Return JSON with:
{{
  "improvements": [
    {{
       "id": "",
       "type": "",
       "field": "",
       "before": "",
       "after": "",
       "reason": ""
    }}
  ],
  "new_resume_draft": ""
}}
"""

    response = _gemini_call(prompt)

    try:
        data = json.loads(response)
        return data["improvements"], data["new_resume_draft"]
    except:
        raise HTTPException(500, "Invalid JSON from Gemini (analyze)")


# ===========================================================
# ✅ Генерация HTML-резюме
# ===========================================================
def gemini_generate_html(fields, template_html):
    prompt = f"""
Generate resume HTML based on this template:

TEMPLATE:
<<<HTML
{template_html}
HTML

FIELDS (JSON):
{json.dumps(fields, ensure_ascii=False)}

RULES:
- Replace placeholders like [FULL_NAME], [SUMMARY_HTML], [SKILLS_HTML]
- Only output final HTML
- No extra text
"""

    html = _gemini_call(prompt)
    return html
