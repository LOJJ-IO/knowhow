import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.audit_log import AuditLogEntry

GENESIS_HASH = "0" * 64


def _canonical_content(
    org_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action_type: str,
    target_resource_id: str | None,
    details: dict,
    sequence: int,
    created_at: datetime,
) -> str:
    """Deterministic serialization of an entry's content fields. Both the
    writer and the verifier must build this identically, or the chain will
    appear broken even when nothing was tampered with."""
    payload = {
        "org_id": str(org_id),
        "actor_user_id": str(actor_user_id) if actor_user_id else None,
        "action_type": action_type,
        "target_resource_id": target_resource_id,
        "details": details,
        "sequence": sequence,
        "created_at": created_at.isoformat(),
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _compute_entry_hash(prev_hash: str, content: str) -> str:
    return hashlib.sha256((prev_hash + content).encode("utf-8")).hexdigest()


def record_audit_entry(
    org_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action_type: str,
    target_resource_id: str | None,
    details: dict,
    db: Session | None = None,
) -> AuditLogEntry:
    """Append one entry to org_id's audit chain. Required side effect of every
    permission, ownership, or structural change in the system — a missing call
    here for such a change is a bug, not an omission to fix later.

    Writes are serialized per-organization via a Postgres transaction-scoped
    advisory lock (keyed on org_id) rather than row locking, since the very
    first entry for an org has no existing row to lock against.
    """
    owns_session = db is None
    session = db or SessionLocal()
    try:
        session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:org_id))"), {"org_id": str(org_id)})

        latest = session.execute(
            select(AuditLogEntry)
            .where(AuditLogEntry.org_id == org_id)
            .order_by(AuditLogEntry.sequence.desc())
            .limit(1)
        ).scalar_one_or_none()

        prev_hash = latest.entry_hash if latest else GENESIS_HASH
        sequence = (latest.sequence + 1) if latest else 1
        created_at = datetime.now(timezone.utc)

        content = _canonical_content(
            org_id, actor_user_id, action_type, target_resource_id, details, sequence, created_at
        )
        entry_hash = _compute_entry_hash(prev_hash, content)

        entry = AuditLogEntry(
            id=uuid.uuid4(),
            org_id=org_id,
            actor_user_id=actor_user_id,
            action_type=action_type,
            target_resource_id=target_resource_id,
            details=details,
            created_at=created_at,
            prev_hash=prev_hash,
            entry_hash=entry_hash,
            sequence=sequence,
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return entry
    finally:
        if owns_session:
            session.close()


@dataclass
class ChainVerificationResult:
    valid: bool
    entries_checked: int
    broken_at_sequence: int | None = None
    detail: str | None = None


def verify_audit_chain(org_id: uuid.UUID, db: Session | None = None) -> ChainVerificationResult:
    """Walks org_id's audit chain in sequence order and reports the exact
    sequence number where the chain first breaks (hash mismatch, or a
    sequence gap indicating a deleted/skipped entry), rather than just a
    pass/fail boolean."""
    owns_session = db is None
    session = db or SessionLocal()
    try:
        entries = (
            session.execute(
                select(AuditLogEntry).where(AuditLogEntry.org_id == org_id).order_by(AuditLogEntry.sequence)
            )
            .scalars()
            .all()
        )

        expected_prev_hash = GENESIS_HASH
        expected_sequence = 1

        for entry in entries:
            if entry.sequence != expected_sequence:
                return ChainVerificationResult(
                    valid=False,
                    entries_checked=expected_sequence - 1,
                    broken_at_sequence=expected_sequence,
                    detail=f"expected sequence {expected_sequence}, found {entry.sequence} (gap or duplicate)",
                )

            if entry.prev_hash != expected_prev_hash:
                return ChainVerificationResult(
                    valid=False,
                    entries_checked=expected_sequence - 1,
                    broken_at_sequence=entry.sequence,
                    detail="prev_hash does not match the previous entry's entry_hash",
                )

            content = _canonical_content(
                entry.org_id,
                entry.actor_user_id,
                entry.action_type,
                entry.target_resource_id,
                entry.details,
                entry.sequence,
                entry.created_at,
            )
            recomputed = _compute_entry_hash(entry.prev_hash, content)
            if recomputed != entry.entry_hash:
                return ChainVerificationResult(
                    valid=False,
                    entries_checked=expected_sequence - 1,
                    broken_at_sequence=entry.sequence,
                    detail="entry_hash does not match recomputed hash of stored content (row was tampered with)",
                )

            expected_prev_hash = entry.entry_hash
            expected_sequence += 1

        return ChainVerificationResult(valid=True, entries_checked=len(entries))
    finally:
        if owns_session:
            session.close()
