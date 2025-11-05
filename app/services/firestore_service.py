from google.cloud import firestore
from typing import Any, Dict

db = firestore.Client()

def get_doc(collection: str, doc_id: str) -> Dict[str, Any]:
    doc = db.collection(collection).document(doc_id).get()
    if not doc.exists:
        return None
    return doc.to_dict()

def set_doc(collection: str, doc_id: str, data: Dict[str, Any]):
    db.collection(collection).document(doc_id).set(data)

def update_doc(collection: str, doc_id: str, data: Dict[str, Any]):
    db.collection(collection).document(doc_id).update(data)

def delete_doc(collection: str, doc_id: str):
    db.collection(collection).document(doc_id).delete()

def create_subcollection_doc(collection, doc_id, subcol, sub_id, data):
    db.collection(collection).document(doc_id).collection(subcol).document(sub_id).set(data)

def get_subcollection(collection, doc_id, subcol):
    docs = db.collection(collection).document(doc_id).collection(subcol).stream()
    return [doc.to_dict() for doc in docs]
