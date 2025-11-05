import datetime
from google.cloud import storage
from app.config import settings
from google.cloud import storage
from google.cloud.storage import Blob
from datetime import timedelta
from fastapi import HTTPException
from app.config import settings
import uuid

client = storage.Client()
bucket = client.bucket(settings.GCS_BUCKET)

def create_signed_url(object_name: str, content_type: str):
    blob = bucket.blob(object_name)
    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(seconds=settings.SIGNED_URL_TTL),
        method="PUT",
        content_type=content_type,
    )

def upload_to_gcs(path: str, data: bytes, content_type="application/pdf"):
    blob = bucket.blob(path)
    try:
        blob.upload_from_string(
            data,
            content_type=content_type
        )
    except Exception as e:
        raise HTTPException(500, f"GCS upload error: {e}")


def upload_fileobj_to_gcs(path: str, fileobj, content_type):
    blob = bucket.blob(path)
    try:
        blob.upload_from_file(fileobj, content_type=content_type)
    except Exception as e:
        raise HTTPException(500, f"GCS upload error: {e}")


def generate_signed_url(path: str, ttl_seconds=3600):
    blob = bucket.blob(path)
    try:
        url = blob.generate_signed_url(
            expiration=datetime.timedelta(seconds=ttl_seconds),
            method="GET"
        )
        return url
    except Exception as e:
        raise HTTPException(500, f"Signed URL generation error: {e}")