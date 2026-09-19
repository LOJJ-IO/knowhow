import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class TransferBatchType(str, enum.Enum):
    # Bulk/retroactive: initial onboarding sweeps, org-chart edits that
    # re-evaluate existing files, any batch spanning multiple files.
    # Mandatory confirm-before-execute — see TransferBatchStatus.
    BULK = "bulk"
    # Routine single-file Auto-Own on file creation, under a team's standing
    # auto_own_enabled rule. Executes immediately (no confirmation gate) —
    # still a TransferBatch of exactly one item, so it stays individually
    # reversible and audited the same way. See app/transfers/service.py.
    SINGLE_FILE_AUTO_OWN = "single_file_auto_own"


class TransferBatchStatus(str, enum.Enum):
    PLANNED = "planned"  # dry-run plan computed and persisted; BULK batches stop here until confirmed
    EXECUTED = "executed"
    REVERSED = "reversed"


class TransferBatch(Base):
    """The only irreversible action Knohow performs against a client's live
    Drive is ownership transfer, so every transfer — whether a large bulk
    sweep or a single Auto-Own-on-creation — is planned and recorded here
    before (BULK) or as part of (SINGLE_FILE_AUTO_OWN) execution. See
    TransferBatchType for which of those two confirmation rules applies."""

    __tablename__ = "transfer_batches"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    batch_type: Mapped[TransferBatchType] = mapped_column(
        value_enum(TransferBatchType, "transfer_batch_type"), nullable=False
    )
    status: Mapped[TransferBatchStatus] = mapped_column(
        value_enum(TransferBatchStatus, "transfer_batch_status"),
        nullable=False,
        default=TransferBatchStatus.PLANNED,
    )

    created_by_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = created_at_col()
    confirmed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    reversed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    items: Mapped[list["TransferBatchItem"]] = relationship(back_populates="batch")


class TransferEligibility(str, enum.Enum):
    ELIGIBLE = "eligible"
    INELIGIBLE_PERSONAL_ACCOUNT = "ineligible_personal_account"


class TransferItemStatus(str, enum.Enum):
    PENDING = "pending"
    TRANSFERRED = "transferred"
    FAILED = "failed"
    REVERSED = "reversed"
    SKIPPED_INELIGIBLE = "skipped_ineligible"


class TransferBatchItem(Base):
    __tablename__ = "transfer_batch_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transfer_batches.id"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Prior owner is always recorded — this is what makes reverse_transfer_batch
    # possible. current_owner_member_id is nullable only for the rare case the
    # owner isn't a known OrgMember (e.g. a file owned by someone outside the
    # org's member records).
    current_owner_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    proposed_owner_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False
    )

    eligibility: Mapped[TransferEligibility] = mapped_column(
        value_enum(TransferEligibility, "transfer_eligibility"), nullable=False
    )
    status: Mapped[TransferItemStatus] = mapped_column(
        value_enum(TransferItemStatus, "transfer_item_status"), nullable=False, default=TransferItemStatus.PENDING
    )
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = created_at_col()

    batch: Mapped["TransferBatch"] = relationship(back_populates="items")
