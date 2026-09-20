import httpx

DIRECTORY_USERS_ENDPOINT = "https://admin.googleapis.com/admin/directory/v1/users"


class DirectoryLookupError(Exception):
    """Google answered with something other than the user record or a
    not-authorized refusal — the check couldn't be completed either way."""


def is_super_admin(access_token: str, email: str) -> bool:
    """Admin proof: looks up the caller's own Directory record under their
    own authorization. Google only returns it to an administrator, and
    `isAdmin` is true only for a Super Admin — so a True here is Google's
    word, not the person's. A non-admin gets 403 (or a record without
    isAdmin), which is simply "not proven"."""
    response = httpx.get(
        f"{DIRECTORY_USERS_ENDPOINT}/{email}",
        params={"fields": "primaryEmail,isAdmin"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10.0,
    )
    if response.status_code == 200:
        return response.json().get("isAdmin") is True
    if response.status_code == 403 and _error_reason(response) == "forbidden":
        return False  # "Not Authorized to access this resource/api" — not an admin
    # Anything else (API not enabled in the GCP project, bad token, outage)
    # means the check didn't run — never read that as "not an admin".
    raise DirectoryLookupError(
        f"Directory API returned {response.status_code} ({_error_reason(response)}): {_error_message(response)}"
    )


def _error_message(response: httpx.Response) -> str | None:
    try:
        return response.json().get("error", {}).get("message")
    except ValueError:
        return None


def _error_reason(response: httpx.Response) -> str | None:
    try:
        errors = response.json().get("error", {}).get("errors") or [{}]
    except ValueError:
        return None
    return errors[0].get("reason")
