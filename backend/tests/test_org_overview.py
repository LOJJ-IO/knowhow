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
