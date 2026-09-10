"""Shared Drive ownership-transfer primitives. Used by both the auth
module's offboarding primitive (app/offboarding/service.py) and the
org-engine module's TransferBatch execution (app/transfers/service.py) —
kept here, not duplicated in each, per this repo's "import from the auth
module, don't reimplement" rule.
"""

from googleapiclient.discovery import Resource

from app.google.retry import google_api_call


def transfer_ownership(drive: Resource, file_id: str, new_owner_email: str) -> None:
    google_api_call(
        drive.permissions()
        .create(
            fileId=file_id,
            body={"role": "owner", "type": "user", "emailAddress": new_owner_email},
            transferOwnership=True,
        )
        .execute
    )


def revoke_permission_if_not_owner(drive: Resource, file_id: str, member_email: str) -> None:
    """Removes member_email's permission on file_id, unless they are still
    the owner (e.g. an ownership transfer for this file wasn't eligible/
    didn't happen) — never strands a file with a downgraded former owner
    still holding access after a successful transfer, but never removes an
    owner's own access either."""
    permissions = google_api_call(
        drive.permissions().list(fileId=file_id, fields="permissions(id,emailAddress,role)").execute
    )
    own = next(
        (p for p in permissions.get("permissions", []) if p.get("emailAddress", "").lower() == member_email.lower()),
        None,
    )
    if own is not None and own.get("role") != "owner":
        google_api_call(drive.permissions().delete(fileId=file_id, permissionId=own["id"]).execute)
