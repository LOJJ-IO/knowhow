from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration is sourced from environment variables. Nothing here is
    a default credential — required secrets have no default and fail fast at
    startup via pydantic-settings if unset."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Runtime ---
    environment: str = "development"
    port: int = 8000
    log_level: str = "INFO"

    # --- Database (Railway injects DATABASE_URL for the managed Postgres addon) ---
    database_url: str

    # --- Google OAuth client (used for app login + per-user personal-account consent) ---
    google_oauth_client_id: str
    google_oauth_client_secret: str
    google_oauth_redirect_uri: str

    # --- Domain-wide delegation service account ---
    # Path to (or inline JSON of) the service account key created in GCP.
    # See backend/docs/gcp-setup.md for provisioning steps.
    google_service_account_json: str

    # --- Secrets ---
    # Fernet key (base64, 32 bytes) used to encrypt OAuth refresh tokens at rest.
    token_encryption_key: str
    # Signing key for session JWTs.
    jwt_signing_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_ttl_seconds: int = 3600
    jwt_refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30

    # --- Frontend ---
    # Origin the Next.js app is served from, for CORS + post-login redirects.
    frontend_origin: str


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
