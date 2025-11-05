import json
import requests
from fastapi import HTTPException
from app.config import settings

MODEL = settings.VERTEX_MODEL
LOCATION = settings.GCP_LOCATION
PROJECT = settings.PROJECT_ID

API_URL = (
    f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/"
    f"locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent"
)


def gemini_extract_resume_fields(text: str) -> dict:
    prompt = f"""
You are a resume extraction engine. Extract structured fields from the resume text.

Resume text:
{text}

Return JSON with this schema:
{{
  "full_name": "",
  "email": "",
  "phone": "",
  "summary": "",
  "skills": [],
  "education": [],
  "experience": []
}}
"""

    response = _gemini_call(prompt)
    try:
        return json.loads(response)
    except:
        raise HTTPException(500, "Invalid JSON from Gemini in extract_resume_fields")


def gemini_analyze_resume(fields_verified: dict, jd_text: str, user_profile: dict):
    prompt = f"""
You are a professional resume analyst.

User profile:
{json.dumps(user_profile, ensure_ascii=False)}

Verified resume fields:
{json.dumps(fields_verified, ensure_ascii=False)}

Job description:
{jd_text}


Your tasks:
1) Compare resume with JD.
2) Suggest improvements as independent change objects.
3) Each change must have:
   - id
   - type ("skill_add", "skill_remove", "experience_edit", "summary_rewrite", etc.)
   - field ("skills", "summary", "experience", etc.)
   - before (if exists)
   - after (if exists)
   - reason (why needed)

Return JSON:
{{
  "improvements": [...],
  "new_resume_draft": "string"
}}
"""

    response = _gemini_call(prompt)

    try:
        data = json.loads(response)
        return data["improvements"], data["new_resume_draft"]
    except:
        raise HTTPException(500, "Invalid JSON from Gemini analyze")


def gemini_generate_html(fields, template_html):
    prompt = """
    You generate clean, production-ready HTML resume based on the template.
    
    TEMPLATE HTML:
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #111;
      line-height: 1.55;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 4px;
    }
    .contact {
      color: #555;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .section-title {
      margin-top: 28px;
      margin-bottom: 6px;
      font-weight: bold;
      font-size: 16px;
      border-bottom: 1px solid #ddd;
    }
    .skill-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .skill-badge {
      background: #f2f2f2;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
    }
    .exp-item {
      margin-bottom: 14px;
    }
    .exp-item-title {
      font-weight: bold;
    }
    .exp-item-company {
      color: #444;
    }
    .exp-item-dates {
      font-size: 12px;
      color: #777;
    }
    </style>
    </head>
    
    <body>
    
    <h1>[FULL_NAME]</h1>
    <div class="contact">[EMAIL] · [PHONE] · [LOCATION]</div>
    
    <div class="section-title">Summary</div>
    <div>[SUMMARY_HTML]</div>
    
    <div class="section-title">Skills</div>
    <div class="skill-badges">[SKILLS_HTML]</div>
    
    <div class="section-title">Experience</div>
    <div>[EXPERIENCE_HTML]</div>
    
    <div class="section-title">Education</div>
    <div>[EDUCATION_HTML]</div>
    
    </body>
    </html>
    USER FIELDS (JSON):
    """ + json.dumps(fields, ensure_ascii=False) + """
    RULES:
    - Replace placeholders like [FULL_NAME], [SUMMARY_HTML], [SKILLS_HTML].
    - Skills must be rendered as <span> elements.
    - Experience must be rendered as structured HTML blocks.
    - Do NOT change layout, styling or CSS.
    - Do NOT add JavaScript or external links.
    - Output ONLY the final HTML.
    """
    html = _gemini_call(prompt)
    return html


from google.auth import default
from google.auth.transport.requests import Request


def _gemini_call(prompt: str) -> str:
    creds, _ = default()
    creds.refresh(Request())

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {creds.token}"
    }

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ]
    }

    try:
        r = requests.post(API_URL, headers=headers, json=payload, timeout=25)
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(500, f"Gemini API error: {e}, body={r.text}")

    try:
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except:
        raise HTTPException(500, f"Unexpected Gemini structure: {r.text}")
