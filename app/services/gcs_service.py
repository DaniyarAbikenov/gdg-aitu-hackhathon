import datetime
from google.cloud import storage
from fastapi import HTTPException
from app.config import settings

# Инициализация клиента для GCS
client = storage.Client()
bucket = client.bucket(settings.GCS_BUCKET)

# Генерация подписанного URL для PUT (загрузка)
def create_signed_url(object_name: str, content_type: str):
    blob = bucket.blob(object_name)
    try:
        return blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(seconds=settings.SIGNED_URL_TTL),
            method="PUT",
            content_type=content_type,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to create signed URL: {e}")


# Загрузка данных в GCS (из байтов)
def upload_bytes_to_gcs(path: str, data: bytes, content_type="application/pdf"):
    blob = bucket.blob(path)
    try:
        blob.upload_from_string(data, content_type=content_type)

    except Exception as e:
        raise HTTPException(500, f"GCS upload error: {e}")


# Генерация подписанного URL для GET (для скачивания)
def generate_signed_url(path: str, ttl_seconds=3600):
    try:
        blob = bucket.blob(path)
        return blob.generate_signed_url(
            expiration=datetime.timedelta(seconds=ttl_seconds),
            method="GET"
        )
    except Exception as e:
        raise HTTPException(500, f"Signed URL generation error: {e}")
