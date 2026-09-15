import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.exceptions import CrossOrgAccessDenied
from app.google.drive_client import get_drive_client_for_user
from app.google.ownership import revoke_permission_if_not_owner, transfer_ownership
from app.models.org_member import AuthType, OrgMember
from app.models.transfer_batch import (
    TransferBatch,
    TransferBatchItem,
    TransferBatchStatus,
    TransferBatchType,
    TransferEligibility,
    TransferItemStatus,
)
from app.models.unresolved_ownership import UnresolvedOwnership, UnresolvedOwnershipReason


@dataclass
class PlannedTransfer:
    file_id: str
    current_owner_member_id: uuid.UUID | None
    proposed_owner_member_id: uuid.UUID


def _require_batch_in_org(batch_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> TransferBatch:
    batch = db.get(TransferBatch, batch_id)
    if batch is None:
        raise ValueError(f"no TransferBatch with id={batch_id}")
    if batch.org_id != org_id:
        raise CrossOrgAccessDenied(f"transfer batch {batch_id} does not belong to organization {org_id}")
    return batch


def _eligibility(current_owner: OrgMember | None, proposed_owner: OrgMember) -> TransferEligibility:
    if (
        current_owner is not None
        and current_owner.auth_type == AuthType.DOMAIN_DELEGATED
        and proposed_owner.auth_type == AuthType.DOMAIN_DELEGATED
    ):
        return TransferEligibility.ELIGIBLE
    return TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT


def _plan_items(
    org_id: uuid.UUID, planned: list[PlannedTransfer], db: Session
) -> list[TransferBatchItem]:
    items: list[TransferBatchItem] = []
    for p in planned:
        current_owner = db.get(OrgMember, p.current_owner_member_id) if p.current_owner_member_id else None
        proposed_owner = db.get(OrgMember, p.proposed_owner_member_id)
        if proposed_owner is None:
            raise ValueError(f"no OrgMember with id={p.proposed_owner_member_id}")

        eligibility = _eligibility(current_owner, proposed_owner)
        detail = None
        if eligibility == TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT:
            detail = (
                f"File {p.file_id} cannot have ownership transferred: Google does not permit Drive "
                "ownership transfer across the Workspace domain boundary, and at least one side of "
                "this transfer is a personal-account member."
            )

        items.append(
            TransferBatchItem(
                id=uuid.uuid4(),
                file_id=p.file_id,
                current_owner_member_id=p.current_owner_member_id,
                proposed_owner_member_id=p.proposed_owner_member_id,
                eligibility=eligibility,
                detail=detail,
            )
        )
    return items


def create_transfer_batch(
    org_id: uuid.UUID,
    reason: str,
    created_by_member_id: uuid.UUID | None,
    planned: list[PlannedTransfer],
    db: Session,
) -> TransferBatch:
    """Computes the full transfer PLAN for a bulk/retroactive operation
    (initial onboarding sweeps, org-chart edits that re-evaluate existing
    files, any batch spanning multiple files) and persists it. Nothing
    executes until confirm_transfer_batch() is called explicitly —
    personal-account-owned files are marked ineligible here, with a clear
    reason, rather than attempted and failed."""
    batch = TransferBatch(
        id=uuid.uuid4(),
        org_id=org_id,
        batch_type=TransferBatchType.BULK,
        status=TransferBatchStatus.PLANNED,
        created_by_member_id=created_by_member_id,
        reason=reason,
    )
    db.add(batch)
    db.flush()

    for item in _plan_items(org_id, planned, db):
        item.batch_id = batch.id
        db.add(item)

    db.commit()
    db.refresh(batch)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=created_by_member_id,
        action_type="transfer_batch.created",
        target_resource_id=str(batch.id),
        details={"reason": reason, "item_count": len(planned)},
        db=db,
    )
    return batch


def _execute_item(item: TransferBatchItem, current_owner: OrgMember, proposed_owner: OrgMember) -> None:
    drive = get_drive_client_for_user(current_owner.id)
    transfer_ownership(drive, item.file_id, proposed_owner.email)
    revoke_permission_if_not_owner(drive, item.file_id, current_owner.email)
    item.status = TransferItemStatus.TRANSFERRED


def _execute_batch(batch: TransferBatch, db: Session) -> None:
    for item in batch.items:
        proposed_owner = db.get(OrgMember, item.proposed_owner_member_id)
        current_owner = db.get(OrgMember, item.current_owner_member_id) if item.current_owner_member_id else None

        if item.eligibility != TransferEligibility.ELIGIBLE or current_owner is None:
            item.status = TransferItemStatus.SKIPPED_INELIGIBLE
            reason = (
                UnresolvedOwnershipReason.PERSONAL_ACCOUNT_OWNER
                if current_owner is None or current_owner.auth_type == AuthType.PERSONAL_OAUTH
                else UnresolvedOwnershipReason.PERSONAL_ACCOUNT_RECIPIENT
            )
            db.add(
                UnresolvedOwnership(
                    id=uuid.uuid4(),
                    org_id=batch.org_id,
                    file_id=item.file_id,
                    current_owner_member_id=item.current_owner_member_id,
                    intended_recipient_member_id=item.proposed_owner_member_id,
                    reason=reason,
                    detail=item.detail or "Ownership transfer not permitted across the domain boundary.",
                )
            )
            continue

        try:
            _execute_item(item, current_owner, proposed_owner)
        except HttpError as exc:
            item.status = TransferItemStatus.FAILED
            item.detail = str(exc)

    batch.status = TransferBatchStatus.EXECUTED
    batch.executed_at = datetime.now(timezone.utc)


def confirm_transfer_batch(batch_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> TransferBatch:
    batch = _require_batch_in_org(batch_id, org_id, db)
    if batch.status != TransferBatchStatus.PLANNED:
        raise ValueError(f"transfer batch {batch_id} is {batch.status.value}, not planned")

    batch.confirmed_at = datetime.now(timezone.utc)
    db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="transfer_batch.confirmed",
        target_resource_id=str(batch.id),
        details={},
        db=db,
    )

    _execute_batch(batch, db)
    db.commit()
    db.refresh(batch)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="transfer_batch.executed",
        target_resource_id=str(batch.id),
        details={
            "transferred": sum(1 for i in batch.items if i.status == TransferItemStatus.TRANSFERRED),
            "failed": sum(1 for i in batch.items if i.status == TransferItemStatus.FAILED),
            "skipped_ineligible": sum(1 for i in batch.items if i.status == TransferItemStatus.SKIPPED_INELIGIBLE),
        },
        db=db,
    )
    return batch


def auto_own_single_file(
    org_id: uuid.UUID,
    file_id: str,
    current_owner_member_id: uuid.UUID,
    proposed_owner_member_id: uuid.UUID,
    db: Session,
) -> TransferBatch:
    """Routine single-file Auto-Own on file creation, under a team's
    standing auto_own_enabled rule. Executes immediately — no confirmation
    gate — per the product's promise that ownership is assigned the moment
    a file is created. Still a TransferBatch of exactly one item (so it
    stays individually reversible via reverse_transfer_batch), and still
    fully audited; it simply skips the "confirmed" stage bulk batches go
    through, since there is nothing to confirm for a single routine file.
    """
    batch = TransferBatch(
        id=uuid.uuid4(),
        org_id=org_id,
        batch_type=TransferBatchType.SINGLE_FILE_AUTO_OWN,
        status=TransferBatchStatus.PLANNED,
        created_by_member_id=None,
        reason=f"Auto-Own on creation of file {file_id}",
    )
    db.add(batch)
    db.flush()

    planned = [PlannedTransfer(file_id, current_owner_member_id, proposed_owner_member_id)]
    for item in _plan_items(org_id, planned, db):
        item.batch_id = batch.id
        db.add(item)
    db.commit()
    db.refresh(batch)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=current_owner_member_id,
        action_type="transfer_batch.created",
        target_resource_id=str(batch.id),
        details={"reason": batch.reason, "item_count": 1, "batch_type": batch.batch_type.value},
        db=db,
    )

    _execute_batch(batch, db)
    db.commit()
    db.refresh(batch)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=current_owner_member_id,
        action_type="transfer_batch.executed",
        target_resource_id=str(batch.id),
        details={"item": batch.items[0].status.value if batch.items else None},
        db=db,
    )
    return batch


def reverse_transfer_batch(batch_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> TransferBatch:
    batch = _require_batch_in_org(batch_id, org_id, db)
    if batch.status != TransferBatchStatus.EXECUTED:
        raise ValueError(f"transfer batch {batch_id} is {batch.status.value}, not executed")

    for item in batch.items:
        if item.status != TransferItemStatus.TRANSFERRED:
            continue
        proposed_owner = db.get(OrgMember, item.proposed_owner_member_id)
        prior_owner = db.get(OrgMember, item.current_owner_member_id)
        if proposed_owner is None or prior_owner is None:
            continue
        try:
            drive = get_drive_client_for_user(proposed_owner.id)
            transfer_ownership(drive, item.file_id, prior_owner.email)
            revoke_permission_if_not_owner(drive, item.file_id, proposed_owner.email)
            item.status = TransferItemStatus.REVERSED
        except HttpError as exc:
            item.detail = f"reversal failed: {exc}"

    batch.status = TransferBatchStatus.REVERSED
    batch.reversed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(batch)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="transfer_batch.reversed",
        target_resource_id=str(batch.id),
        details={"reversed": sum(1 for i in batch.items if i.status == TransferItemStatus.REVERSED)},
        db=db,
    )
    return batch
