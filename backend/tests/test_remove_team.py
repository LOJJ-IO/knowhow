"""Removing a team from Manage teams (Ronald, 2026-10-05): move or offboard
its people first, and nothing is left pointing at it."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.file_index import FileIndex
from app.models.librarian import FolderFile, KnohowFolder
from app.models.org_chart import OrgChart
from app.models.org_membership import OrgMembership, OrgRole
from app.models.team import Team
from app.offboarding.service import OffboardResult
from app.org_chart import remove_team as rt
from app.org_chart import service as chart_service
from tests.test_librarian import D, _member, _org, db  # noqa: F401  (db is a fixture)


@pytest.fixture(autouse=True)
def _quiet(monkeypatch):
    monkeypatch.setattr(rt, "record_audit_entry", lambda **_k: None)
    monkeypatch.setattr(chart_service, "record_audit_entry", lambda **_k: None)
    offboarded = []

    def fake_revoke(user_id, org_id, transfer_to, db=None):
        offboarded.append((user_id, transfer_to))
        return OffboardResult(user_id=user_id, org_id=org_id, transfer_to_user_id=transfer_to)

    monkeypatch.setattr(chart_service, "revoke_and_offboard", fake_revoke)
    return offboarded


def _setup(db):
    """Design (lead + worker, a file, a folder) and Sales; `boss` owns the org."""
    org, lead, worker, design = _org(db)
    boss = _member(db, org, f"boss@{D}")
    db.execute(select(OrgChart).where(OrgChart.org_id == org.id)).scalar_one().owner_member_id = boss.id
    sales = Team(id=uuid.uuid4(), org_id=org.id, name="Sales")
    child = Team(id=uuid.uuid4(), org_id=org.id, name="Design Ops", parent_team_id=design.id)
    db.add_all([sales, child])
    now = datetime.now(timezone.utc)
    db.add(
        FileIndex(
            file_id="spec", org_id=org.id, owner_user_id=worker.id, team_id=design.id,
            file_type="application/vnd.google-apps.document", title="Spec",
            created_at=now, modified_at=now, sharing_state={}, last_synced_at=now,
        )
    )
    folder = KnohowFolder(org_id=org.id, team_id=design.id, name="Design")
    db.add(folder)
    db.flush()
    db.add(FolderFile(folder_id=folder.id, file_id="spec", added_by=worker.id))
    sales.share_extra_team_ids = [str(design.id)]
    db.commit()
    return org, boss, lead, worker, design, sales, child


def test_only_owner_or_super_admin(db):
    org, _boss, lead, _worker, design, sales, _child = _setup(db)
    with pytest.raises(PermissionError):
        rt.remove_team(org.id, design.id, lead, db, move_to_team_id=sales.id)


def test_people_must_be_moved_or_offboarded(db):
    org, boss, *_rest = _setup(db)
    design = _rest[2]
    with pytest.raises(rt.RemoveTeamError):
        rt.remove_team(org.id, design.id, boss, db)


def test_move_everyone_takes_people_files_and_folder(db):
    org, boss, lead, worker, design, sales, child = _setup(db)
    rt.remove_team(org.id, design.id, boss, db, move_to_team_id=sales.id)

    assert db.get(Team, design.id) is None
    in_sales = set(
        db.execute(select(OrgMembership.user_id).where(OrgMembership.team_id == sales.id)).scalars()
    )
    assert in_sales == {lead.id, worker.id}
    roles = set(db.execute(select(OrgMembership.role).where(OrgMembership.team_id == sales.id)).scalars())
    assert roles == {OrgRole.MEMBER}
    assert db.get(FileIndex, "spec").team_id == sales.id
    sales_folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == sales.id)).scalar_one()
    assert db.execute(select(FolderFile.file_id).where(FolderFile.folder_id == sales_folder.id)).scalars().all() == ["spec"]
    assert db.get(Team, child.id).parent_team_id is None
    assert db.get(Team, sales.id).share_extra_team_ids == []


def test_offboard_everyone_leaves_files_as_company_files(db, _quiet):
    org, boss, lead, worker, design, _sales, _child = _setup(db)
    rt.remove_team(org.id, design.id, boss, db, offboard_to_user_id=boss.id)

    assert db.get(Team, design.id) is None
    assert {u for u, _ in _quiet} == {lead.id, worker.id}
    assert all(to == boss.id for _, to in _quiet)
    assert db.execute(select(OrgMembership).where(OrgMembership.user_id.in_([lead.id, worker.id]))).first() is None
    assert db.get(FileIndex, "spec").team_id is None
    assert db.execute(select(KnohowFolder).where(KnohowFolder.name == "Design")).first() is None


def test_offboard_recipient_cannot_be_in_the_team(db):
    org, boss, lead, _worker, design, _sales, _child = _setup(db)
    with pytest.raises(rt.RemoveTeamError):
        rt.remove_team(org.id, design.id, boss, db, offboard_to_user_id=lead.id)


def test_empty_team_just_goes(db):
    org, boss, *_rest = _setup(db)
    sales = _rest[3]
    rt.remove_team(org.id, sales.id, boss, db)
    assert db.get(Team, sales.id) is None
