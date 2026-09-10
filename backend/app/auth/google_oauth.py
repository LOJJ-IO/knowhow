from urllib.parse import urlencode

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import get_settings

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


def build_authorization_url(
    scopes: list[str],
    state: str,
    code_challenge: str,
    *,
    access_type: str = "online",
    prompt: str | None = None,
    login_hint: str | None = None,
) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": access_type,
    }
    if prompt:
        params["prompt"] = prompt
    if login_hint:
        params["login_hint"] = login_hint
    return f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}"


def exchange_code_for_tokens(code: str, code_verifier: str) -> dict:
    settings = get_settings()
    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": settings.google_oauth_redirect_uri,
        },
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


def verify_id_token(id_token_str: str) -> dict:
    """Verifies the Google-signed ID token (signature + audience + issuer),
    rather than just base64-decoding it — this is the identity assertion the
    whole login flow trusts, so it must not be taken on faith."""
    settings = get_settings()
    return google_id_token.verify_oauth2_token(
        id_token_str, google_requests.Request(), audience=settings.google_oauth_client_id
    )
