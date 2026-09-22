"""The dashboard's one read: `org_overview` must reflect *everything*
onboarding produced, not just the teams.

Against a real Postgres (conftest's test database); skipped when it isn't
reachable, the same way test_identity_linking does it.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal
from app.models.join_link import JoinLink
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.person import Person
from app.models.team import Team
from app.onboarding.service import org_overview


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = (
        session.execute(
            text(
                "select tablename from pg_tables where schemaname = 'public' "
                "and tablename != 'alembic_version'"
            )
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


def _member(db, org, email, name=None, standing=MemberStanding.APPROVED, person_id=None):
    member = OrgMember(
        organization_id=org.id,
        email=email,
        display_name=name,
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=standing,
        person_id=person_id,
    )
    db.add(member)
    db.flush()
    return member


def _onboarded_org(db):
    """An org as onboarding leaves it: named, owned, two teams, the founder in
    one of them, a live join link, and someone waiting for approval."""
    org = Organization(name="Acme", observed_domain="acme.org", setup_step="done")
    org.setup_completed_at = datetime.now(timezone.utc)
    db.add(org)
    db.flush()

    founder = _member(db, org, "founder@acme.org", "Ada")
    waiting = _member(db, org, "new@acme.org", standing=MemberStanding.AUTO_AFFILIATED)

    db.add(OrgChart(org_id=org.id, initiator_member_id=founder.id, owner_member_id=founder.id))

    engineering = Team(org_id=org.id, name="Engineering", team_leader_id=founder.id)
    finance = Team(org_id=org.id, name="Finance")
    db.add_all([engineering, finance])
    db.flush()

    db.add_all(
        [
            OrgMembership(org_id=org.id, user_id=founder.id, team_id=engineering.id, role=OrgRole.TEAM_LEADER),
            # Org-wide, no team: must not be counted as a team membership.
            OrgMembership(org_id=org.id, user_id=founder.id, team_id=None, role=OrgRole.TOP_LEADER),
        ]
    )
    db.add(JoinLink(organization_id=org.id, token=uuid.uuid4().hex, created_by_member_id=founder.id))
    db.commit()
    return org, founder, waiting, engineering, finance


def test_overview_carries_every_answer_onboarding_collected(db):
    org, founder, waiting, engineering, finance = _onboarded_org(db)

    overview = org_overview(org.id, db)

    assert overview["organization"]["name"] == "Acme"
    assert overview["organization"]["observed_domain"] == "acme.org"
    assert overview["organization"]["setup_step"] == "done"
    assert overview["organization"]["setup_completed_at"] is not None
    assert overview["owner_member_id"] == str(founder.id)

    teams = {t["name"]: t for t in overview["teams"]}
    assert set(teams) == {"Engineering", "Finance"}
    assert teams["Engineering"]["team_leader_id"] == str(founder.id)
    assert teams["Engineering"]["member_ids"] == [str(founder.id)]
    assert teams["Finance"]["member_ids"] == []

    members = {m["email"]: m for m in overview["members"]}
    assert members["founder@acme.org"]["team_ids"] == [str(engineering.id)]
    # The org-wide row is a role, not a team.
    assert members["founder@acme.org"]["org_wide_roles"] == ["top_leader"]
    assert members["new@acme.org"]["standing"] == "auto_affiliated"

    assert overview["join_link"]["active"] is True
    assert overview["pending_members"] == 1


def test_revoked_and_expired_join_links_do_not_read_as_live(db):
    org, founder, *_ = _onboarded_org(db)

    link = db.execute(text("select id from join_links")).scalars().one()
    db.execute(text("update join_links set revoked_at = now() where id = :id"), {"id": link})
    db.commit()
    assert org_overview(org.id, db)["join_link"]["active"] is False

    db.add(
        JoinLink(
            organization_id=org.id,
            token=uuid.uuid4().hex,
            created_by_member_id=founder.id,
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
    )
    db.commit()
    assert org_overview(org.id, db)["join_link"]["active"] is False


def test_linked_accounts_share_a_person_id(db):
    org, founder, *_ = _onboarded_org(db)
    # "Add another account" in onboarding: one human, two addresses.
    person = Person(display_name="Ada")
    db.add(person)
    db.flush()
    founder.person_id = person.id
    _member(db, org, "ada@gmail.com", "Ada", person_id=person.id)
    db.commit()

    by_email = {m["email"]: m for m in org_overview(org.id, db)["members"]}
    assert by_email["founder@acme.org"]["person_id"] == by_email["ada@gmail.com"]["person_id"]


def _audit(db, org, action, actor=None, target=None, details=None):
    """Writes through the real audit service so entries are chained the way
    production writes them."""
    from app.audit.service import record_audit_entry

    return record_audit_entry(
        org_id=org.id,
        actor_user_id=actor.id if actor else None,
        action_type=action,
        target_resource_id=target,
        details=details or {},
        db=db,
    )


def test_changes_attribute_to_the_right_team(db):
    org, founder, _waiting, engineering, finance = _onboarded_org(db)

    # 1. details.team_id — a membership written for a team.
    _audit(db, org, "org_chart.membership.upserted", founder, str(uuid.uuid4()),
           {"team_id": str(finance.id), "user_id": str(founder.id)})
    # 2. target_resource_id that is a team — the team.* actions.
    _audit(db, org, "org_chart.team.edited", founder, str(engineering.id), {"name": "Eng"})
    # 3. no team anywhere — an org-wide change, kept rather than dropped.
    _audit(db, org, "organization.renamed", founder, str(org.id), {"name": "Acme"})
    db.commit()

    changes = org_overview(org.id, db, viewer=founder)["changes"]

    assert changes["teams"][str(finance.id)]["count"] == 1
    assert changes["teams"][str(engineering.id)]["count"] == 1
    actions = {e["action"] for e in changes["organization"]}
    assert "organization.renamed" in actions
    # The org chart and teams created by the fixture are in there too.
    assert changes["total"] >= 3


def test_changes_follow_a_file_to_its_team(db):
    from app.models.file_index import FileIndex

    org, founder, _waiting, engineering, _finance = _onboarded_org(db)
    now = datetime.now(timezone.utc)
    db.add(
        FileIndex(
            file_id="drive-file-1",
            org_id=org.id,
            owner_user_id=founder.id,
            team_id=engineering.id,
            file_type="document",
            title="Roadmap",
            created_at=now,
            modified_at=now,
            last_synced_at=now,
        )
    )
    db.commit()

    _audit(db, org, "transfer_batch.executed", founder, None, {"file_id": "drive-file-1"})
    db.commit()

    teams = org_overview(org.id, db, viewer=founder)["changes"]["teams"]
    actions = {e["action"] for e in teams[str(engineering.id)]["events"]}
    assert "transfer_batch.executed" in actions


def test_seeing_the_dashboard_clears_what_came_before_it(db):
    from app.onboarding.service import mark_dashboard_seen

    org, founder, _waiting, engineering, _finance = _onboarded_org(db)
    _audit(db, org, "org_chart.team.edited", founder, str(engineering.id), {})
    db.commit()
    assert org_overview(org.id, db, viewer=founder)["changes"]["total"] > 0

    mark_dashboard_seen(founder, db)
    assert org_overview(org.id, db, viewer=founder)["changes"]["total"] == 0

    # Something new after the stamp counts again.
    _audit(db, org, "org_chart.team.edited", founder, str(engineering.id), {})
    db.commit()
    after = org_overview(org.id, db, viewer=founder)["changes"]
    assert after["teams"][str(engineering.id)]["count"] == 1


def test_a_member_who_never_opened_the_dashboard_sees_everything(db):
    org, founder, *_ = _onboarded_org(db)
    assert founder.dashboard_seen_at is None
    # The fixture's own setup wrote nothing to the audit log, so add one.
    _audit(db, org, "onboarding.member_added", founder, str(founder.id), {})
    db.commit()
    assert org_overview(org.id, db, viewer=founder)["changes"]["total"] >= 1
