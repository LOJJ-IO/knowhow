import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class PersonEmail(Base):
    """A Google address proven to belong to a person, that has no membership
    anywhere.

    This exists for one case: someone signs in with a personal account, says
    "yes, I have an organization account", and signs in to the company. No
    personal org is created for them (user, 2026-09-20), so there is no
    OrgMember to hang the personal address on — but the address was verified
    by Google and is worth remembering, so the next sign-in knows whose it is.

    It grants nothing: it is a record of identity, never of access.
    """

    __tablename__ = "person_emails"
    __table_args__ = (UniqueConstraint("email", name="uq_person_emails_email"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("people.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    created_at: Mapped[datetime] = created_at_col()
