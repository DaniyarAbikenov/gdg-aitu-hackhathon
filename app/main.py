import os

import firebase_admin
from fastapi import FastAPI
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware


from google.cloud import firestore, storage, documentai
from google.api_core.exceptions import GoogleAPIError
from google import genai
from app.config import settings
if settings.DEBUG:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "firebase-key.json"
else:
    firebase_admin.initialize_app()   # БЕЗ credentials=...
bearer_scheme = HTTPBearer()


from app.config import settings
from app.routers import user, auth, resume, interview

app = FastAPI(
    title="CareerBot AI Backend",
    version="0.1.0",
    description="API для CareerBot AI (FastAPI + Google Cloud)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "https://gdg-hackathon-aitu.web.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/test-cloud")
def test_google_cloud():
    result = {}

    PROJECT = settings.PROJECT_ID
    LOCATION = settings.GCP_LOCATION

    # --- Firestore ---
    try:
        db = firestore.Client()
        collections = [c.id for c in db.collections()]
        result["firestore"] = {"status": "ok", "collections": collections[:3]}
    except Exception as e:
        result["firestore"] = {"status": "error", "message": str(e)}

    # --- Cloud Storage ---
    try:
        storage_client = storage.Client()
        buckets = [b.name for b in storage_client.list_buckets()]
        result["storage"] = {"status": "ok", "buckets": buckets[:3]}
    except Exception as e:
        result["storage"] = {"status": "error", "message": str(e)}

    # --- Vertex AI (Gemini) ---
    try:
        genai_client = genai.Client(
            vertexai=True,
            project="gdg-hackathon-aitu",
            location="us-central1"
        )
        response = genai_client.models.generate_content(
            model="publishers/google/models/gemini-2.5-pro",
            contents="hello",
        )
        result["vertex_ai"] = {"status": "ok", "sample": response.text[:40]}
    except Exception as e:
        result["vertex_ai"] = {"status": "error", "message": str(e)}

    # --- Document AI ---
    try:
        da_client = documentai.DocumentProcessorServiceClient()
        # parent = f"projects/{PROJECT}/locations/{LOCATION}"
        parent="projects/56998693149/locations/us"
        processors = da_client.list_processors(parent=parent)
        print(type(processors))
        first = next(iter(processors), None)
        if first:
            result["document_ai"] = {"status": "ok", "processor": first.display_name}
        else:
            result["document_ai"] = {"status": "ok", "processor": "none"}
    except Exception as e:
        result["document_ai"] = {"status": "error", "message": str(e)}

    return result


app.include_router(user.router)
app.include_router(resume.router)
app.include_router(interview.router)

