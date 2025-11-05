from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_ID: str
    GCP_LOCATION: str = "us-central1"
    FIRESTORE_PREFIX: str = "prod_"
    GCS_BUCKET: str
    DOC_AI_PROCESSOR_ID: str
    FIREBASE_PROJECT_ID: str
    VERTEX_MODEL: str = "gemini-1.5-pro"
    SIGNED_URL_TTL: int = 3600
    STT_ENABLED: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
