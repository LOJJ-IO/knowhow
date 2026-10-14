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


def hand_over_personal_ownership(
    owner_drive: Resource, new_owner_drive: Resource, file_id: str, new_owner_email: str
) -> None:
    """Ownership between two personal Google accounts: the owner makes the
    new owner an editor marked `pendingOwner`, then the new owner accepts
    (their own client sets role=owner with transferOwnership). Google
    doesn't allow a one-step transfer between consumer accounts."""
    perm = google_api_call(
        owner_drive.permissions()
        .create(
            fileId=file_id,
            body={"role": "writer", "type": "user", "emailAddress": new_owner_email},
            sendNotificationEmail=False,
            fields="id",
        )
        .execute
    )
    google_api_call(
        owner_drive.permissions()
        .update(fileId=file_id, permissionId=perm["id"], body={"role": "writer", "pendingOwner": True})
        .execute
    )
    google_api_call(
        new_owner_drive.permissions()
        .update(fileId=file_id, permissionId=perm["id"], body={"role": "owner"}, transferOwnership=True)
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
