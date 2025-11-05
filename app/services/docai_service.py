from google.cloud import documentai_v1 as documentai
from fastapi import HTTPException
from app.config import settings

client = documentai.DocumentProcessorServiceClient()
project = settings.PROJECT_ID
location = settings.GCP_LOCATION  # должно быть 'us'
processor_id = settings.DOC_AI_PROCESSOR_ID


def docai_extract_text(gcs_path: str) -> str:
    name = client.processor_path(project, location, processor_id)

    request = documentai.ProcessRequest(
        name=name,
        gcs_document=documentai.GcsDocument(
            gcs_uri=gcs_path,
            mime_type="application/pdf"
        )
    )

    try:
        result = client.process_document(request=request)
    except Exception as e:
        raise HTTPException(500, f"DocAI error: {e}")

    document = result.document
    return document.text or ""
