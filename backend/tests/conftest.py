import os

# Test-only dummy configuration, set before any `app.*` module is imported
# (pydantic-settings' Settings() has no defaults for these — real ones must
# never be committed, so tests supply throwaway values instead).
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DATABASE_URL", "postgresql://knohow:knohow@localhost:5432/knohow_test")
os.environ.setdefault("GOOGLE_OAUTH_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/callback")
os.environ.setdefault("GOOGLE_SERVICE_ACCOUNT_JSON", '{"type": "service_account"}')
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "ApHpz5M8EFt6CneO1ECH0UMp-lnBJENYV5SGVivu5rc=")
os.environ.setdefault("JWT_SIGNING_KEY", "test-signing-key-not-for-production-use")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:3000")
