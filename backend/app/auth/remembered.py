"""Accounts this browser has signed in with, for the Log In account picker.

Deliberately not an identity feature. Knohow has no way to know that two
Google accounts belong to the same person (identity linking is unbuilt), so
this records only "this browser has signed in as these members". It confers
no access: a remembered row is a shortcut to Google's sign-in, nothing more.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.remembered_account import RememberedAccount


@dataclass
class RememberedAccountView:
    email: str
    display_name: str | None
    organization_id: uuid.UUID
    organization_name: str


def remember_account(device_id: uuid.UUID, member: OrgMember, db: Session) -> None:
    """Records (or refreshes) one account against this browser. Called after
    a sign-in succeeds, never before — an account that failed to sign in was
    never "used here"."""
    row = db.execute(
        select(RememberedAccount).where(
            RememberedAccount.device_id == device_id, RememberedAccount.member_id == member.id
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        db.add(RememberedAccount(device_id=device_id, member_id=member.id, last_seen_at=now))
    else:
        row.last_seen_at = now
    db.commit()


def list_remembered_accounts(device_id: uuid.UUID, db: Session) -> list[RememberedAccountView]:
    """Most recently used first. Joins the org so the frontend can name it on
    rows that lead somewhere different from the rest."""
    rows = db.execute(
        select(OrgMember, Organization)
        .join(RememberedAccount, RememberedAccount.member_id == OrgMember.id)
        .join(Organization, Organization.id == OrgMember.organization_id)
        .where(RememberedAccount.device_id == device_id)
        .order_by(RememberedAccount.last_seen_at.desc())
    ).all()
    return [
        RememberedAccountView(
            email=member.email,
            display_name=member.display_name,
            organization_id=organization.id,
            organization_name=organization.name,
        )
        for member, organization in rows
    ]


def forget_device(device_id: uuid.UUID, db: Session) -> int:
    """"Remove accounts" — drops every account remembered on this browser.
    Deletes only the picker's rows; the members and their orgs are
    untouched, and signing in again re-adds them."""
    result = db.execute(delete(RememberedAccount).where(RememberedAccount.device_id == device_id))
    db.commit()
    return result.rowcount or 0
