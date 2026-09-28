"""Notifications tasks (ADR-0026): shown to whoever can act, and an owner
claim is never confirmed by the claimant."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.onboarding.tasks import decide_owner_claim, pending_tasks


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = session.execute(
        text("select tablename from pg_tables where schemaname = 'public' and tablename != 'alembic_version'")
    ).scalars().all()
    session.execute(text(f"truncate {', '.join(tables)} restart identity cascade"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _org(db):
    org = Organization(id=uuid.uuid4(), name="Acme", observed_domain="acme.com")
    founder = OrgMember(
        id=uuid.uuid4(), organization_id=org.id, email="founder@acme.com",
        auth_type=AuthType.DOMAIN_DELEGATED, standing=MemberStanding.APPROVED,
    )
    other = OrgMember(
        id=uuid.uuid4(), organization_id=org.id, email="other@acme.com",
        auth_type=AuthType.DOMAIN_DELEGATED, standing=MemberStanding.APPROVED,
    )
    db.add(org)
    db.flush()
    db.add(founder)
    db.flush()
    db.add(other)
    chart = OrgChart(id=uuid.uuid4(), org_id=org.id, initiator_member_id=founder.id, owner_member_id=None)
    db.add(chart)
    db.commit()
    return org, founder, other, chart


def _kinds(tasks):
    return [t["kind"] for t in tasks]


def test_founder_sees_setup_gaps(db):
    org, founder, _other, _chart = _org(db)
    assert _kinds(pending_tasks(org.id, founder, db)) == [
        "no_owner", "no_super_admin", "company_drive", "own_drive",
    ]


def test_plain_member_only_sees_their_own_drive(db):
    org, _founder, other, _chart = _org(db)
    assert _kinds(pending_tasks(org.id, other, db)) == ["own_drive"]


def test_founder_confirms_someone_elses_claim(db):
    org, founder, other, chart = _org(db)
    chart.pending_owner_member_id = other.id
    db.commit()
    assert "owner_claim" in _kinds(pending_tasks(org.id, founder, db))
    decide_owner_claim(org.id, founder, True, db)
    db.refresh(chart)
    assert (chart.owner_member_id, chart.pending_owner_member_id) == (other.id, None)


def test_founder_cannot_confirm_their_own_claim(db):
    org, founder, _other, chart = _org(db)
    chart.pending_owner_member_id = founder.id
    db.commit()
    assert "owner_claim" not in _kinds(pending_tasks(org.id, founder, db))
    with pytest.raises(PermissionError):
        decide_owner_claim(org.id, founder, True, db)


def test_super_admin_task_goes_once_someone_is_verified(db):
    org, founder, other, _chart = _org(db)
    other.super_admin_verified_at = datetime.now(timezone.utc)
    db.commit()
    assert "no_super_admin" not in _kinds(pending_tasks(org.id, founder, db))
