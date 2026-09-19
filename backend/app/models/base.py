import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def created_at_col() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


def value_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Postgres ENUM stored by member *value* ("domain_delegated"), matching
    the migrations. SQLAlchemy's default stores the member *name*
    ("DOMAIN_DELEGATED"), which the database types reject."""
    return Enum(enum_cls, name=name, values_callable=lambda cls: [member.value for member in cls])
