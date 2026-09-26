"""Privacy invariants from FEAT-drive-file-classification:

- Rule 3: a file nobody has confirmed as Company never gets a FileIndex row,
  so its title is not retained (constraint 3) and it can't reach leaders.
- DeepSearch returns only indexed (confirmed Company) files through role
  visibility; an unindexed file shows to its own owner and nobody else.
- "Private" (company file hidden from coworkers, leaders keep access) is
  what the old `personal` flag meant; the name must not be reused.

Against a real Postgres (conftest's test database); skipped when unreachable.
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.activity import reconciliation
from app.db import SessionLocal
from app.models.audit_log import AuditLogEntry
from app.models.file_index import FileIndex
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.suggested_share import SuggestedShare
from app.models.team import Team
from app.search import deepsearch
from app.sharing.service import handle_file_created, mark_file_private
from app.sharing.visibility import can_view_file

SECRET_TITLE = "Divorce Lawyer.pdf"


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = (
        session.execute(
            text("select tablename from pg_tables where schemaname = 'public' and tablename != 'alembic_version'")
        )
        .scalars()
        .all()
    )
    session.execute(text(f"truncate {', '.join(tables)} restart identity cascade"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _member(db, org, email):
    member = OrgMember(
        organization_id=org.id,
        email=email,
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.APPROVED,
    )
    db.add(member)
    db.flush()
    return member


@pytest.fixture
def org(db):
    """Acme: a top leader, and Marketing with a lead and two members."""
    org = Organization(name="Acme", observed_domain="acme.org", setup_step="done")
    db.add(org)
    db.flush()
    boss = _member(db, org, "boss@acme.org")
    lead = _member(db, org, "lead@acme.org")
    sarah = _member(db, org, "sarah@acme.org")
    tom = _member(db, org, "tom@acme.org")
    marketing = Team(org_id=org.id, name="Marketing", team_leader_id=lead.id)
    db.add(marketing)
    db.flush()
    db.add_all(
        [
            OrgMembership(org_id=org.id, user_id=boss.id, team_id=None, role=OrgRole.TOP_LEADER),
            OrgMembership(org_id=org.id, user_id=lead.id, team_id=marketing.id, role=OrgRole.TEAM_LEADER),
            OrgMembership(org_id=org.id, user_id=sarah.id, team_id=marketing.id, role=OrgRole.MEMBER),
            OrgMembership(org_id=org.id, user_id=tom.id, team_id=marketing.id, role=OrgRole.MEMBER),
        ]
    )
    db.commit()
    return {"org": org, "boss": boss, "lead": lead, "sarah": sarah, "tom": tom, "marketing": marketing}


def _audit_text(db) -> str:
    return " ".join(str(a.details) for a in db.execute(select(AuditLogEntry)).scalars())


def _index(db, o, file_id, owner):
    now = datetime.now(timezone.utc)
    row = FileIndex(
        file_id=file_id,
        org_id=o["org"].id,
        owner_user_id=owner.id,
        team_id=o["marketing"].id,
        file_type="application/pdf",
        title="Q3 Plan",
        created_at=now,
        modified_at=now,
        sharing_state={},
        last_synced_at=now,
    )
    db.add(row)
    db.commit()
    return row


# --- Rule 3: detection never indexes -------------------------------------------------


def test_a_detected_file_is_not_indexed_and_its_title_is_not_kept(db, org):
    result = handle_file_created(
        org_id=org["org"].id,
        file_id="drive-file-1",
        title=SECRET_TITLE,
        file_type="application/pdf",
        creator_user_id=org["sarah"].id,
        created_via_knohow=False,
        detected_via="reports_feed",
        db=db,
    )

    assert result["action"] == "suggested_share_created"
    assert db.get(FileIndex, "drive-file-1") is None
    suggestion = db.execute(select(SuggestedShare)).scalar_one()
    assert suggestion.file_id == "drive-file-1"
    assert SECRET_TITLE not in _audit_text(db)


def test_the_reconciliation_sweep_does_not_index_what_it_finds(db, org, monkeypatch):
    listed = [{"id": "drive-file-2", "name": SECRET_TITLE, "mimeType": "application/pdf"}]
    monkeypatch.setattr(
        reconciliation, "_list_owned_files", lambda member_id, db: listed if member_id == org["sarah"].id else []
    )

    summary = reconciliation.reconcile_organization(org["org"].id, db)
    again = reconciliation.reconcile_organization(org["org"].id, db)

    assert summary["new_files_detected"] == 1
    assert again["new_files_detected"] == 1  # still unconfirmed, still not indexed
    assert db.get(FileIndex, "drive-file-2") is None
    assert db.execute(select(SuggestedShare)).scalars().all().__len__() == 1  # idempotent
    assert SECRET_TITLE not in _audit_text(db)


# --- DeepSearch --------------------------------------------------------------------


class _FakeDrive:
    def __init__(self, files):
        self._files = files

    def files(self):
        return self

    def list(self, **_):
        return self

    def execute(self):
        return {"files": self._files}


def _drive_holding(files_by_member):
    return lambda member_id, db: _FakeDrive(files_by_member.get(member_id, []))


def _hit(file_id, owner_email, name=SECRET_TITLE):
    return {"id": file_id, "name": name, "mimeType": "application/pdf", "owners": [{"emailAddress": owner_email}]}


def test_deepsearch_hides_unindexed_files_from_leaders(db, org, monkeypatch):
    monkeypatch.setattr(
        deepsearch, "get_drive_client_for_user", _drive_holding({org["sarah"].id: [_hit("sarah-own", "sarah@acme.org")]})
    )

    for leader in ("boss", "lead"):
        results = deepsearch.search(org["org"].id, org[leader].id, "lawyer", db)
        assert results == [], f"{leader} must not see an unconfirmed file"


def test_deepsearch_shows_an_unindexed_file_to_its_own_owner(db, org, monkeypatch):
    monkeypatch.setattr(
        deepsearch, "get_drive_client_for_user", _drive_holding({org["sarah"].id: [_hit("sarah-own", "sarah@acme.org")]})
    )

    results = deepsearch.search(org["org"].id, org["sarah"].id, "lawyer", db)

    assert [r.file_id for r in results] == ["sarah-own"]


def test_deepsearch_shows_indexed_company_files_by_role(db, org, monkeypatch):
    _index(db, org, "company-file", org["sarah"])
    monkeypatch.setattr(
        deepsearch,
        "get_drive_client_for_user",
        _drive_holding({org["sarah"].id: [_hit("company-file", "sarah@acme.org", "Q3 Plan")]}),
    )

    for viewer in ("boss", "lead", "tom"):
        results = deepsearch.search(org["org"].id, org[viewer].id, "plan", db)
        assert [r.file_id for r in results] == ["company-file"], viewer


# --- Private (was "personal") ------------------------------------------------------


def test_a_private_file_is_hidden_from_teammates_but_not_leaders(db, org):
    row = _index(db, org, "draft", org["sarah"])

    mark_file_private(org["org"].id, "draft", org["sarah"].id, db)
    db.refresh(row)

    assert row.sharing_state == {"private": True}
    assert "personal" not in row.sharing_state
    assert not can_view_file(org["tom"].id, row, org["org"].id, db)
    assert can_view_file(org["lead"].id, row, org["org"].id, db)
    assert can_view_file(org["boss"].id, row, org["org"].id, db)
    assert can_view_file(org["sarah"].id, row, org["org"].id, db)
    actions = [a.action_type for a in db.execute(select(AuditLogEntry)).scalars()]
    assert "sharing.file_private_designation_set" in actions
