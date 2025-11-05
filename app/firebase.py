import firebase_admin
from firebase_admin import credentials, auth
from app.config import settings

# Инициализируем Firebase Admin SDK
cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)

default_app = firebase_admin.initialize_app(cred, {
    "projectId": settings.FIREBASE_PROJECT_ID
})

def verify_token(id_token: str) -> str:
    """
    Проверяет Firebase ID Token (JWT)
    Возвращает UID пользователя, если токен валиден.
    """
    decoded = auth.verify_id_token(id_token)
    return decoded["uid"]
