import datetime
from google.cloud import storage
from app.config import settings

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
