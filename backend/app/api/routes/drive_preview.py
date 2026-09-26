import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.exceptions import DelegationNotApproved, PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.models.org_member import OrgMember

router = APIRouter(tags=["drive-preview"])

PREVIEW_SIZE = 24


@router.get("/organizations/{org_id}/drive-preview")
def drive_preview(
    org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    """Proof that the Drive connection works: the caller's OWN most recently
    edited files, read live through their own delegated (or consented) client.

    Nothing here is stored. It never touches `FileIndex`, so it does not
    bypass the classification rule (an unconfirmed file is not indexed); it is
    a read of the caller's own Drive, shown back to the caller only."""
    try:
        drive = get_drive_client_for_user(member.id, db)
        about = drive.about().get(fields="user(emailAddress,displayName)").execute()
        result = (
            drive.files()
            .list(
                q="'me' in owners and trashed = false",
                orderBy="modifiedTime desc",
                pageSize=PREVIEW_SIZE,
                fields="files(id,name,mimeType,modifiedTime)",
            )
            .execute()
        )
    except (DelegationNotApproved, PersonalAccountNotConsented):
        return {"connected": False, "connected_as": None, "files": []}
    except HttpError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Google didn't answer the Drive request ({exc.status_code})."
        ) from exc

    return {
        "connected": True,
        "connected_as": about.get("user", {}).get("emailAddress", member.email),
        "files": [
            {
                "id": f["id"],
                "name": f.get("name", "Untitled"),
                "mime_type": f.get("mimeType", ""),
                "modified_at": f.get("modifiedTime"),
            }
            for f in result.get("files", [])
        ],
    }
