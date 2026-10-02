"""The sales sandbox (Acme) and the screens' read endpoints over it.

The sandbox is the strongest fixture this suite has: a whole company, every
call answered by the in-memory Drive. These tests also pin down that it stays
fenced off from real sign-in and from Google."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.audit.service import verify_audit_chain
from app.db import SessionLocal
from app.google.drive_client import get_drive_client_for_user
from app.main import app
from app.models.file_index import FileIndex
from app.models.join_link import JoinLink
from app.models.org_member import OrgMember
from app.sandbox import SANDBOX_ORG_ID
from app.sandbox.drive import SandboxDrive
from app.sandbox.seed import ensure_seeded

ORG = str(SANDBOX_ORG_ID)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    ensure_seeded(session, force=True)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    c = TestClient(app)
    res = c.get("/sandbox/enter", follow_redirects=False)
    assert res.status_code == 302 and res.headers["location"].endswith("/home")
    return c


def _member(db, email) -> OrgMember:
    return db.execute(
        select(OrgMember).where(OrgMember.organization_id == SANDBOX_ORG_ID, OrgMember.email == email)
    ).scalar_one()


def test_seed_builds_a_whole_company_with_a_valid_audit_chain(db):
    members = db.execute(select(OrgMember).where(OrgMember.organization_id == SANDBOX_ORG_ID)).scalars().all()
    assert len(members) >= 25
    assert db.execute(select(FileIndex).where(FileIndex.org_id == SANDBOX_ORG_ID)).scalars().first() is not None
    assert verify_audit_chain(SANDBOX_ORG_ID, db).valid


def test_reseed_replaces_rather_than_duplicates(db):
    first = ensure_seeded(db, force=True)
    second = ensure_seeded(db, force=True)
    assert first != second
    assert ensure_seeded(db) == second  # fresh: reused, not rebuilt
    emails = db.execute(select(OrgMember.email).where(OrgMember.organization_id == SANDBOX_ORG_ID)).scalars().all()
    assert len(emails) == len(set(emails))


def test_sandbox_members_get_the_in_memory_drive_never_google(db):
    alex = _member(db, "alex@acme.com")
    drive = get_drive_client_for_user(alex.id, db)
    assert isinstance(drive, SandboxDrive)
    mine = drive.files().list(q="'me' in owners and trashed = false").execute()["files"]
    assert mine and all(f["owners"][0]["emailAddress"] == "alex@acme.com" for f in mine)
    hits = drive.files().list(q="fullText contains 'pricing' and trashed = false").execute()["files"]
    assert any("Pricing" in f["name"] for f in hits)


def test_nobody_real_can_join_the_sandbox(db, client):
    # A join link made inside the sandbox is refused at sign-in and in previews.
    alex = _member(db, "alex@acme.com")
    db.add(JoinLink(organization_id=SANDBOX_ORG_ID, token="sandbox-link", created_by_member_id=alex.id))
    db.commit()
    assert TestClient(app).get("/join-links/sandbox-link").status_code == 404
    from app.onboarding.service import _org_for_valid_join_token

    with pytest.raises(ValueError, match="join link not found"):
        _org_for_valid_join_token("sandbox-link", db)


def test_screens_read_through_the_sandbox(client):
    me = client.get("/auth/me").json()
    assert me["organization_id"] == ORG and me["is_owner"]
    ownership = client.get(f"/organizations/{ORG}/ownership").json()
    assert ownership["files"] and ownership["unresolved"] and any(b["status"] == "planned" for b in ownership["batches"])
    sharing = client.get(f"/organizations/{ORG}/sharing").json()
    assert len(sharing["teams"]) == 6 and sharing["suggestions"]
    off = client.get(f"/organizations/{ORG}/offboarding").json()
    assert off["active"] and off["history"]
    assert [t["kind"] for t in client.get(f"/organizations/{ORG}/tasks").json()] == ["join_request", "join_request"]
    results = client.get("/search?q=pricing").json()["results"]
    assert results and any(r["company"] and r["team_id"] for r in results)


def test_offboarding_moves_files_and_updates_the_record(db, client):
    ethan, marcus = _member(db, "ethan@acme.com"), _member(db, "marcus@acme.com")
    preview = client.get(
        f"/organizations/{ORG}/offboarding/preview", params={"user_id": str(ethan.id), "transfer_to": str(marcus.id)}
    ).json()
    assert preview["movable"] and preview["files"]
    res = client.post("/offboard", json={"user_id": str(ethan.id), "transfer_to_user_id": str(marcus.id)})
    assert res.status_code == 200, res.text
    db.expire_all()
    still_ethans = db.execute(
        select(FileIndex).where(FileIndex.org_id == SANDBOX_ORG_ID, FileIndex.owner_user_id == ethan.id)
    ).scalars().all()
    assert still_ethans == []


def test_only_owner_admin_or_their_lead_can_offboard(db):
    from app.api.routes.governance import _may_offboard

    sofia, ethan, maya = (_member(db, e) for e in ("sofia@acme.com", "ethan@acme.com", "maya@acme.com"))
    marcus = _member(db, "marcus@acme.com")
    assert not _may_offboard(sofia, ethan.id, db)  # teammate, not their lead
    assert not _may_offboard(maya, ethan.id, db)  # a lead, but of another team
    assert _may_offboard(marcus, ethan.id, db)  # Engineering's lead
    assert not _may_offboard(marcus, marcus.id, db)  # never yourself


def test_undo_puts_ownership_back(db, client):
    batches = client.get(f"/organizations/{ORG}/ownership").json()["batches"]
    executed = next(b for b in batches if b["status"] == "executed")
    item = executed["items"][0]
    assert client.post(f"/transfer-batches/{executed['id']}/reverse").status_code == 200
    db.expire_all()
    assert str(db.get(FileIndex, item["file_id"]).owner_user_id) == item["from_id"]


def test_unknown_member_id_is_404_not_500(client):
    res = client.get(
        f"/organizations/{ORG}/offboarding/preview",
        params={"user_id": str(uuid.uuid4()), "transfer_to": str(uuid.uuid4())},
    )
    assert res.status_code in (403, 404)
