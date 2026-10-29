"""A team's link for people outside the organization (ADR-0035): any Google
account joins that team, asking the lead first unless that's turned off; the
owner and Super Admins are told and can keep or remove them."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.auth.login import members_for_email
from app.auth.pkce import build_state_token
from app.members.outside import (
    create_outside_link,
    keep_outside_member,
    outside_join_tasks,
    remove_outside_member,
    set_outside_ask_first,
)
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.team_join_request import TeamJoinRequest, TeamJoinRequestStatus
from app.onboarding.service import (
    SIGNUP_STATE_PURPOSE,
    decide_team_join_request,
    list_members,
    needs_join_placement,
    resolve_join_link_preview,
)
from app.onboarding.tasks import pending_tasks
from app.org_chart.service import upsert_membership

from test_join_placement import _google, _seed_org_with_link, db  # noqa: F401 — the fixture


def _member(db, org, email, **extra):
    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=email,
        display_name=email.split("@")[0].title(),
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.APPROVED,
        join_placement_completed_at=datetime.now(timezone.utc),
        **extra,
    )
    db.add(member)
    db.commit()
    return member


def _org_with_lead(db):
    org, founder, team, _ = _seed_org_with_link(db)
    lead = _member(db, org, "lead@acme.com")
    team.team_leader_id = lead.id
    upsert_membership(org.id, team.id, lead.id, OrgRole.TEAM_LEADER, db, _skip_audit=True)
    owner = _member(db, org, "owner@acme.com")
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org.id)).scalar_one()
    chart.owner_member_id = owner.id
    db.commit()
    return org, founder, team, lead, owner


def _arrive(db, monkeypatch, link, email, hd=None):
    from app.onboarding.service import complete_signup

    _google(monkeypatch, email, hd=hd, name="Volunteer")
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    return complete_signup("code", state, db).login.member


def test_only_the_teams_lead_and_people_above_make_its_outside_link(db):
    org, founder, team, lead, owner = _org_with_lead(db)
    someone = _member(db, org, "someone@acme.com")
    with pytest.raises(PermissionError):
        create_outside_link(org.id, team.id, "7d", someone, db)
    for actor in (lead, owner, founder):
        assert create_outside_link(org.id, team.id, "7d", actor, db).token
    admin = _member(db, org, "admin@acme.com", super_admin_verified_at=datetime.now(timezone.utc))
    first = create_outside_link(org.id, team.id, "7d", admin, db)
    second = create_outside_link(org.id, team.id, "30d", admin, db)
    db.refresh(first)
    assert first.revoked_at is not None and second.revoked_at is None


def test_the_join_page_previews_an_outside_link(db):
    org, _founder, team, lead, _owner = _org_with_lead(db)
    link = create_outside_link(org.id, team.id, "7d", lead, db)
    preview = resolve_join_link_preview(link.token, db)
    assert preview["valid"] is True
    assert "any Google account" in preview["description"] and team.name in preview["description"]


def test_a_gmail_account_asks_the_lead_first_by_default(db, monkeypatch):
    org, _founder, team, lead, owner = _org_with_lead(db)
    assert team.outside_ask_first is True
    link = create_outside_link(org.id, team.id, "7d", lead, db)

    volunteer = _arrive(db, monkeypatch, link, "volunteer@gmail.com")
    assert volunteer.organization_id == org.id
    assert volunteer.auth_type == AuthType.PERSONAL_OAUTH
    assert volunteer.standing == MemberStanding.AUTO_AFFILIATED
    assert volunteer.joined_from_outside_at is not None
    assert not needs_join_placement(volunteer, db)

    request = db.execute(select(TeamJoinRequest).where(TeamJoinRequest.member_id == volunteer.id)).scalar_one()
    assert request.status == TeamJoinRequestStatus.PENDING
    assert "join_request" in {t["kind"] for t in pending_tasks(org.id, lead, db)}
    # Not on a team yet, so the owner isn't told yet: the lead decides first.
    assert outside_join_tasks(org.id, owner, db) == []

    decide_team_join_request(org.id, request.id, True, lead, db)
    db.refresh(volunteer)
    assert volunteer.standing == MemberStanding.APPROVED
    tasks = [t for t in pending_tasks(org.id, owner, db) if t["kind"] == "outside_joined"]
    assert len(tasks) == 1 and tasks[0]["teams"][0]["name"] == team.name


def test_anyone_with_the_link_joins_when_asking_is_off(db, monkeypatch):
    org, _founder, team, lead, owner = _org_with_lead(db)
    set_outside_ask_first(org.id, team.id, False, lead, db)
    link = create_outside_link(org.id, team.id, "7d", lead, db)

    volunteer = _arrive(db, monkeypatch, link, "helper@partner.org", hd="partner.org")
    # Another Workspace domain: delegation can't reach it, so its own consent.
    assert volunteer.auth_type == AuthType.PERSONAL_OAUTH
    assert volunteer.standing == MemberStanding.APPROVED
    assert db.execute(
        select(OrgMembership).where(OrgMembership.team_id == team.id, OrgMembership.user_id == volunteer.id)
    ).scalar_one().role == OrgRole.MEMBER
    assert [t["id"] for t in outside_join_tasks(org.id, owner, db)] == [str(volunteer.id)]

    # Super Admins are told too; the lead and ordinary members aren't.
    admin = _member(db, org, "admin@acme.com", super_admin_verified_at=datetime.now(timezone.utc))
    assert len(outside_join_tasks(org.id, admin, db)) == 1
    assert outside_join_tasks(org.id, lead, db) == []


def test_people_already_elsewhere_get_their_own_membership(db, monkeypatch):
    org, _founder, team, lead, _owner = _org_with_lead(db)
    other, _f, _t, _l = _seed_org_with_link(db, domain="other.org")
    elsewhere = _member(db, other, "me@gmail.com")
    set_outside_ask_first(org.id, team.id, False, lead, db)
    link = create_outside_link(org.id, team.id, "7d", lead, db)

    joined = _arrive(db, monkeypatch, link, "me@gmail.com")
    assert joined.id != elsewhere.id and joined.organization_id == org.id
    # Signing in through it again is a sign-in, not a second row.
    assert _arrive(db, monkeypatch, link, "me@gmail.com").id == joined.id


def test_an_account_on_the_orgs_own_domain_isnt_outside(db, monkeypatch):
    org, _founder, team, lead, owner = _org_with_lead(db)
    set_outside_ask_first(org.id, team.id, False, lead, db)
    link = create_outside_link(org.id, team.id, "7d", lead, db)
    colleague = _arrive(db, monkeypatch, link, "new@acme.com", hd="acme.com")
    assert colleague.auth_type == AuthType.DOMAIN_DELEGATED
    assert colleague.joined_from_outside_at is None
    assert outside_join_tasks(org.id, owner, db) == []


def test_keep_clears_the_notice_for_everyone(db, monkeypatch):
    org, _founder, team, lead, owner = _org_with_lead(db)
    set_outside_ask_first(org.id, team.id, False, lead, db)
    volunteer = _arrive(db, monkeypatch, create_outside_link(org.id, team.id, "7d", lead, db), "v@gmail.com")
    with pytest.raises(PermissionError):
        keep_outside_member(org.id, volunteer.id, lead, db)
    keep_outside_member(org.id, volunteer.id, owner, db)
    assert outside_join_tasks(org.id, owner, db) == []


def test_removing_takes_them_out_of_the_org_for_good(db, monkeypatch):
    org, _founder, team, lead, owner = _org_with_lead(db)
    set_outside_ask_first(org.id, team.id, False, lead, db)
    link = create_outside_link(org.id, team.id, "7d", lead, db)
    volunteer = _arrive(db, monkeypatch, link, "v@gmail.com")
    team.share_extra_member_ids = [str(volunteer.id)]
    db.commit()

    with pytest.raises(PermissionError):
        remove_outside_member(org.id, volunteer.id, lead, db)
    result = remove_outside_member(org.id, volunteer.id, owner, db)
    assert result["removed"] is True

    db.refresh(volunteer)
    db.refresh(team)
    assert volunteer.removed_at is not None
    assert db.execute(select(OrgMembership).where(OrgMembership.user_id == volunteer.id)).first() is None
    assert team.share_extra_member_ids == []
    assert volunteer.id not in {m.id for m in list_members(org.id, db)}
    # Can't sign in to the org, and the link won't let them back.
    assert members_for_email("v@gmail.com", db) == []
    with pytest.raises(ValueError, match="removed"):
        _arrive(db, monkeypatch, link, "v@gmail.com")
    assert outside_join_tasks(org.id, owner, db) == []


def test_only_people_from_outside_can_be_removed_this_way(db):
    org, _founder, _team, lead, owner = _org_with_lead(db)
    with pytest.raises(ValueError, match="outside"):
        remove_outside_member(org.id, lead.id, owner, db)


def test_removing_takes_back_access_to_the_orgs_files(db, monkeypatch):
    from app.models.file_index import FileIndex

    org, _founder, team, lead, owner = _org_with_lead(db)
    set_outside_ask_first(org.id, team.id, False, lead, db)
    volunteer = _arrive(db, monkeypatch, create_outside_link(org.id, team.id, "7d", lead, db), "v@gmail.com")
    now = datetime.now(timezone.utc)
    for file_id, owner_id in (("lead-doc", lead.id), ("own-doc", volunteer.id)):
        db.add(
            FileIndex(
                file_id=file_id, org_id=org.id, owner_user_id=owner_id, file_type="doc", title=file_id,
                created_at=now, modified_at=now, last_synced_at=now,
            )
        )
    db.commit()

    revoked: list[tuple[str, str]] = []
    monkeypatch.setattr("app.google.drive_client.get_drive_client_for_user", lambda owner_id, _db: f"drive-{owner_id}")
    monkeypatch.setattr(
        "app.google.ownership.revoke_permission_if_not_owner",
        lambda drive, file_id, email: revoked.append((file_id, email)),
    )
    result = remove_outside_member(org.id, volunteer.id, owner, db)
    # Only files someone else owns; their own files stay theirs.
    assert revoked == [("lead-doc", "v@gmail.com")]
    assert result["files_checked"] == 1 and result["files_unreachable"] == 0
