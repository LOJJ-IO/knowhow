import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.auth.delegation import mark_delegation_lost
from app.exceptions import DelegationNotApproved, PersonalAccountNotConsented
from app.librarian import service
from app.models.org_member import OrgMember

router = APIRouter(prefix="/organizations/{org_id}", tags=["librarian"])


DELEGATION_LOST = (
    "Google stopped letting Knohow into Drive. Your Super Admin needs to add Knohow "
    "again under Domain-wide delegation in Google Admin."
)


def _run(fn, member: OrgMember, *args):
    """One translation of the librarian's failures into answers a screen can
    show, so no route leaks a raw Google or Python error."""
    db = args[-1]
    try:
        return fn(member, *args)
    except RefreshError as exc:
        # Delegation was withdrawn in the Admin console after Knohow approved
        # it. Say so, and stop treating the grant as approved.
        db.rollback()
        mark_delegation_lost(member.organization_id, db)
        raise HTTPException(status.HTTP_409_CONFLICT, DELEGATION_LOST) from exc
    except (DelegationNotApproved, PersonalAccountNotConsented) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Drive isn't connected for this account yet.") from exc
    except HttpError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Google didn't answer the Drive request ({exc.status_code})."
        ) from exc
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.LibrarianError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/librarian/scan")
def scan(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    result = _run(service.scan_member_drive, member, db)
    return {"scanned": result.scanned, "suggested": result.suggested, "already_known": result.already_known}


class ImportBody(BaseModel):
    access_token: str
    file_ids: list[str]


@router.post("/librarian/import-personal")
def import_personal(
    org_id: uuid.UUID,
    body: ImportBody,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    from app.librarian.import_personal import import_picked_files

    result = _run(import_picked_files, member, body.access_token, body.file_ids, db)
    return {"imported": result.imported, "failed": result.failed}


class NewDocumentBody(BaseModel):
    kind: str  # "doc" | "sheet" | "slide" | "form"
    name: str | None = None
    # The teams it goes in; the first is the file's team (Ronald, 2026-10-04).
    team_ids: list[uuid.UUID] | None = None


@router.post("/documents")
def create_document(
    org_id: uuid.UUID,
    body: NewDocumentBody,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    from app.documents.service import create_document as _create

    return _run(lambda m, d: _create(m, body.kind, d, name=body.name, team_ids=body.team_ids), member, db)


@router.get("/librarian/review")
def review(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    return _run(service.review_queue, member, db)


class DecisionBody(BaseModel):
    label: str
    confirmed_again: bool = False


@router.post("/librarian/candidates/{candidate_id}/decision")
def decide(
    org_id: uuid.UUID,
    candidate_id: uuid.UUID,
    body: DecisionBody,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    return _run(service.decide, member, candidate_id, body.label, body.confirmed_again, db)


@router.get("/librarian/proposals")
def proposals(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    return _run(service.proposals_for, member, db)


@router.post("/librarian/proposals/{candidate_id}/confirm")
def confirm(
    org_id: uuid.UUID, candidate_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    return _run(service.confirm, member, candidate_id, db)


@router.post("/librarian/proposals/{candidate_id}/decline")
def decline(
    org_id: uuid.UUID, candidate_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    _run(service.decline, member, candidate_id, db)
    return {"result": "declined"}


@router.get("/folders")
def folders(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    return {"folders": _run(service.list_folders, member, db)}


class FolderBody(BaseModel):
    name: str
    color: str | None = None


@router.post("/folders")
def create_folder(
    org_id: uuid.UUID, body: FolderBody, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    return _run(service.create_folder, member, body.name, db, color=body.color)


@router.get("/folders/{folder_id}")
def folder(
    org_id: uuid.UUID, folder_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    return _run(service.folder_detail, member, folder_id, db)


@router.delete("/folders/{folder_id}")
def delete_folder(
    org_id: uuid.UUID, folder_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    _run(service.delete_folder, member, folder_id, db)
    return {"result": "deleted"}


@router.put("/folders/{folder_id}/files/{file_id}")
def add_file(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    file_id: str,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    _run(service.set_file_in_folder, member, folder_id, file_id, True, db)
    return {"result": "added"}


@router.delete("/folders/{folder_id}/files/{file_id}")
def remove_file(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    file_id: str,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    _run(service.set_file_in_folder, member, folder_id, file_id, False, db)
    return {"result": "removed"}


@router.get("/company-files")
def company_files(
    org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    return {"files": _run(service.all_company_files, member, db)}


class RenameBody(BaseModel):
    name: str


@router.patch("/folders/{folder_id}")
def rename_folder(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: RenameBody,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    return _run(service.rename_folder, member, folder_id, body.name, db)


@router.patch("/company-files/{file_id}")
def rename_file(
    org_id: uuid.UUID,
    file_id: str,
    body: RenameBody,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    return _run(service.rename_file, member, file_id, body.name, db)


@router.post("/company-files/{file_id}/trash")
def trash_file(
    org_id: uuid.UUID, file_id: str, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    _run(service.trash_file, member, file_id, db)
    return {"result": "trashed"}


@router.post("/company-files/{file_id}/restore")
def restore_file(
    org_id: uuid.UUID, file_id: str, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    _run(service.restore_file, member, file_id, db)
    return {"result": "restored"}


@router.get("/trash")
def trash(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    return {"files": _run(service.trash, member, db)}
