"""Join link OAuth state, domain lock, lead claim race, and join requests (ADR-0021)."""

import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.auth.pkce import build_state_token, decode_state_token
from app.db import SessionLocal
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.models.team import Team
from app.models.team_join_request import TeamJoinRequest, TeamJoinRequestStatus
from app.onboarding.service import (
    SIGNUP_STATE_PURPOSE,
    TeamPlacementChoice,
    complete_join_placement,
    complete_signup,
    create_join_link,
    create_org_chart,
    is_team_lead,
    claim_pending_owner,
    record_setup_step,
    live_join_link,
    revoke_join_link,
    start_signup,
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = session.execute(
        text(
            "select tablename from pg_tables where schemaname = 'public' and tablename != 'alembic_version'"
        )
    ).scalars().all()
    session.execute(text(f"truncate {', '.join(tables)} restart identity cascade"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _google(monkeypatch, email: str, hd: str | None = None, name: str = "Joiner"):
    claims = {"email": email, "email_verified": True, "name": name}
    if hd:
        claims["hd"] = hd

    monkeypatch.setattr(
        "app.onboarding.service.exchange_code_for_tokens",
        lambda code, verifier: {"id_token": "tok"},
    )
    monkeypatch.setattr("app.onboarding.service.verify_id_token", lambda _t: claims)


def _seed_org_with_link(db, domain="acme.com"):
    org = Organization(
        id=uuid.uuid4(),
        name="Acme",
        observed_domain=domain,
        verified_domain=None,
        setup_step="done",
        setup_completed_at=datetime.now(timezone.utc),
    )
    founder = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=f"founder@{domain}",
        display_name="Founder",
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.APPROVED,
        join_placement_completed_at=datetime.now(timezone.utc),
    )
    db.add(org)
    db.flush()
    db.add(founder)
    db.flush()
    chart = OrgChart(
        id=uuid.uuid4(),
        org_id=org.id,
        initiator_member_id=founder.id,
        owner_member_id=None,
    )
    team = Team(id=uuid.uuid4(), org_id=org.id, name="Design")
    db.add(chart)
    db.add(team)
    db.commit()
    link = create_join_link(org.id, "7d", founder, db)
    return org, founder, team, link


def test_start_signup_carries_join_token(db):
    start = start_signup(join_token="abc123", db=db)
    payload = decode_state_token(start.state, expected_purpose=SIGNUP_STATE_PURPOSE)
    assert payload["join_token"] == "abc123"


def test_join_token_domain_lock_rejects_wrong_hd(db, monkeypatch):
    org, _founder, _team, link = _seed_org_with_link(db)
    _google(monkeypatch, "outsider@other.com", hd="other.com")
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    with pytest.raises(ValueError, match="sign in with a acme.com"):
        complete_signup("code", state, db)


def test_join_token_rejects_personal_account(db, monkeypatch):
    _org, _founder, _team, link = _seed_org_with_link(db)
    _google(monkeypatch, "person@gmail.com", hd=None)
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    with pytest.raises(ValueError, match="work Google accounts"):
        complete_signup("code", state, db)


def test_join_token_places_member_in_org(db, monkeypatch):
    org, _founder, team, link = _seed_org_with_link(db)
    _google(monkeypatch, "alex@acme.com", hd="acme.com")
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    result = complete_signup("code", state, db)
    assert result.login is not None
    assert result.login.member.organization_id == org.id
    assert result.login.member.email == "alex@acme.com"

    placement = complete_join_placement(
        org.id,
        result.login.member,
        [TeamPlacementChoice(team_id=team.id, claim_lead=True)],
        claim_owner=False,
        db=db,
    )
    assert placement["placements"][0]["result"] == "lead_claimed"
    db.refresh(team)
    assert team.team_leader_id == result.login.member.id
    assert is_team_lead(org.id, result.login.member, db)


def test_second_lead_claim_becomes_request(db, monkeypatch):
    org, founder, team, link = _seed_org_with_link(db)
    # First joiner claims lead
    _google(monkeypatch, "lead@acme.com", hd="acme.com")
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    first = complete_signup("code", state, db).login.member
    complete_join_placement(
        org.id, first, [TeamPlacementChoice(team_id=team.id, claim_lead=True)], False, db
    )

    # Second joiner also claims — should request
    _google(monkeypatch, "member@acme.com", hd="acme.com")
    state2 = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    second = complete_signup("code", state2, db).login.member
    out = complete_join_placement(
        org.id, second, [TeamPlacementChoice(team_id=team.id, claim_lead=True)], False, db
    )
    assert out["placements"][0]["result"] == "requested"
    req = db.execute(
        select(TeamJoinRequest).where(
            TeamJoinRequest.team_id == team.id, TeamJoinRequest.member_id == second.id
        )
    ).scalar_one()
    assert req.status == TeamJoinRequestStatus.PENDING

    # Lead can still reissue join link
    create_join_link(org.id, "24h", first, db)
    assert is_team_lead(org.id, first, db)


def test_founder_setup_without_is_owner(db):
    org = Organization(
        id=uuid.uuid4(), name="acme.com", observed_domain="acme.com", verified_domain=None
    )
    founder = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="first@acme.com",
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.AUTO_AFFILIATED,
    )
    db.add(org)
    db.flush()
    db.add(founder)
    db.commit()
    result = create_org_chart(org.id, founder.id, is_owner=False, is_super_admin=False, db=db)
    assert result.org_chart.owner_member_id is None
    assert result.org_chart.initiator_member_id == founder.id


def test_expired_join_token_refused(db, monkeypatch):
    org, founder, _team, link = _seed_org_with_link(db)
    link.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()
    _google(monkeypatch, "late@acme.com", hd="acme.com")
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    with pytest.raises(ValueError, match="expired"):
        complete_signup("code", state, db)


def test_live_join_link_returns_current_until_revoked(db):
    org, founder, _team, link = _seed_org_with_link(db)
    assert live_join_link(org.id, founder, db).id == link.id

    newer = create_join_link(org.id, "30d", founder, db)
    assert live_join_link(org.id, founder, db).id == newer.id

    revoke_join_link(org.id, founder, db)
    assert live_join_link(org.id, founder, db) is None


def test_live_join_link_ignores_expired(db):
    org, founder, _team, link = _seed_org_with_link(db)
    link.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert live_join_link(org.id, founder, db) is None


def test_founder_owner_claim_is_pending_not_granted(db):
    org, founder, _team, _link = _seed_org_with_link(db)
    assert claim_pending_owner(org.id, founder, db) == "pending"
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org.id)).scalar_one()
    assert chart.pending_owner_member_id == founder.id
    assert chart.owner_member_id is None


def test_connect_workspace_is_a_setup_step(db):
    org, _founder, _team, _link = _seed_org_with_link(db)
    assert record_setup_step(org.id, "connectWorkspace", db).setup_step == "connectWorkspace"
