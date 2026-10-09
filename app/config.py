from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_prefix="CAREER_")

    database_url: str = "postgresql+psycopg://career:career@localhost:5432/career"
    redis_url: str = "redis://localhost:6379/0"
    redis_namespace: str = "career"
    provider: Literal["unconfigured", "local", "gemini", "openai"] = "unconfigured"
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = ""
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = ""
    google_client_id: str = ""
    environment: Literal["development", "production"] = "production"
    admin_emails: str = ""
    openai_realtime_model: str = ""
    openai_transcription_model: str = ""
    secure_cookie: bool = False
    session_hours: int = Field(default=24, ge=1, le=168)
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024, le=10_000_000)
    session_creations_per_hour: int = Field(default=30, ge=1, le=500)
    auth_per_15_minutes: int = Field(default=15, ge=1, le=100)
    analysis_per_hour: int = Field(default=30, ge=1, le=1000)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"
    # Error reporting and tracing stay off unless configured.
    sentry_dsn: SecretStr = SecretStr("")
    otel_enabled: bool = False
    # USD per million tokens for the admin cost estimate; 0 shows tokens only.
    ai_input_usd_per_million: float = Field(default=0, ge=0)
    ai_output_usd_per_million: float = Field(default=0, ge=0)
    # Password recovery and email confirmation are offered only when SMTP is configured.
    smtp_url: SecretStr = SecretStr("")
    mail_from: str = "Career Studio <no-reply@localhost>"
    public_url: str = ""

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value):
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("Use a PostgreSQL URL with the psycopg driver")
        return value

    @field_validator("redis_url")
    @classmethod
    def redis_only(cls, value):
        if not value.startswith(("redis://", "rediss://")):
            raise ValueError("Use a Redis service URL")
        return value

    @model_validator(mode="after")
    def require_public_url_for_mail(self):
        if self.smtp_url.get_secret_value() and not self.public_url.startswith(
            ("http://", "https://")
        ):
            raise ValueError("Email links need CAREER_PUBLIC_URL, for example https://example.com")
        return self

    @model_validator(mode="after")
    def require_provider_configuration(self):
        if self.provider == "gemini":
            if not self.gemini_api_key.get_secret_value() or not self.gemini_model:
                raise ValueError("Gemini requires CAREER_GEMINI_API_KEY and CAREER_GEMINI_MODEL")
            if not all(c.isalnum() or c in "-._" for c in self.gemini_model):
                raise ValueError("Use a Gemini model ID, not a URL")
        if self.provider == "openai":
            if not self.openai_api_key.get_secret_value() or not self.openai_model:
                raise ValueError("OpenAI requires CAREER_OPENAI_API_KEY and CAREER_OPENAI_MODEL")
        return self
