from google.cloud import firestore
from app.config import settings

db = firestore.Client(project=settings.PROJECT_ID)

def save_document(collection: str, doc_id: str, data: dict):
    col = f"{settings.FIRESTORE_PREFIX}{collection}"
    db.collection(col).document(doc_id).set(data)

def get_document(collection: str, doc_id: str):
    col = f"{settings.FIRESTORE_PREFIX}{collection}"
    return db.collection(col).document(doc_id).get().to_dict()
