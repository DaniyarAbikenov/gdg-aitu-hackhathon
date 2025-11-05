from pydantic_settings  import BaseSettings

class Settings(BaseSettings):
    PROJECT_ID: str
    GCP_LOCATION: str
    FIRESTORE_PREFIX: str
    GCS_BUCKET: str
    FIREBASE_PROJECT_ID: str
    GOOGLE_APPLICATION_CREDENTIALS: str
    DOC_AI_PROCESSOR_ID: str
    AI_MODEL: str
    VERTEX_MODEL: str
    SIGNED_URL_TTL: int = 3600
    STT_ENABLED: bool = False
    DEBUG: bool = True
    PORT: int = 8080

    class Config:
        env_file = ".env"

settings = Settings()
