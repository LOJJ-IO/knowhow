"""Club orgs (ADR-0034): no domain, join by link with any Google account,
several orgs per account, no Workspace tasks, a club account that file
ownership moves to where Google allows."""

import uuid

import pytest
from sqlalchemy import select

from app.auth.pkce import build_state_token, decode_state_token
from app.librarian.rules import classify_club, member_collaborator_emails
from app.models.librarian import LibrarianSuggestion
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import ORG_KIND_CLUB, Organization
from app.onboarding.service import (
    SIGNUP_STATE_PURPOSE,
    complete_signup,
    create_join_link,
    create_org_chart,
    set_club_account,
    start_signup,
)
from app.onboarding.tasks import pending_tasks
from app.transfers.service import _eligibility
from app.models.transfer_batch import TransferEligibility

from test_join_placement import _google, _seed_org_with_link, db  # noqa: F401 — the fixture


def _club_state():
    return build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"club": True})


def _start_club(db, monkeypatch, email="pres@ualberta.ca", hd="ualberta.ca"):
    _google(monkeypatch, email, hd=hd, name="President")
    member = complete_signup("code", _club_state(), db).login.member
    create_org_chart(member.organization_id, member.id, False, False, db)
    return db.get(Organization, member.organization_id), member


def test_start_signup_carries_the_club_flag(db):
    payload = decode_state_token(start_signup(club=True, db=db).state, expected_purpose=SIGNUP_STATE_PURPOSE)
    assert payload["club"] is True


def test_a_ualberta_student_starts_a_club_without_claiming_the_domain(db, monkeypatch):
    org, member = _start_club(db, monkeypatch)
    assert org.kind == ORG_KIND_CLUB
    assert org.observed_domain is None and org.verified_domain is None
    assert member.auth_type == AuthType.DOMAIN_DELEGATED
    # A second club by another ualberta student is its own org.
    other, _ = _start_club(db, monkeypatch, email="chess@ualberta.ca")
    assert other.id != org.id


def test_anyone_joins_a_club_by_link_even_from_another_org(db, monkeypatch):
    club, president = _start_club(db, monkeypatch)
    link = create_join_link(club.id, "7d", president, db)
    join = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})

    # A Gmail account (no hd) can join a club.
    _google(monkeypatch, "alum@gmail.com", hd=None)
    alum = complete_signup("code", join, db).login.member
    assert alum.organization_id == club.id and alum.auth_type == AuthType.PERSONAL_OAUTH
    assert alum.standing == MemberStanding.APPROVED

    # Someone already in a company org gets a second membership.
    company, _founder, _team, _ = _seed_org_with_link(db, domain="acme.com")
    _google(monkeypatch, "worker@acme.com", hd="acme.com")
    worker = OrgMember(
        id=uuid.uuid4(), organization_id=company.id, email="worker@acme.com",
        auth_type=AuthType.DOMAIN_DELEGATED, standing=MemberStanding.APPROVED,
    )
    db.add(worker)
    db.commit()
    joined = complete_signup("code", join, db).login.member
    assert joined.organization_id == club.id and joined.id != worker.id
    rows = db.execute(select(OrgMember).where(OrgMember.email == "worker@acme.com")).scalars().all()
    assert {r.organization_id for r in rows} == {company.id, club.id}

    # Signing in through the link again is just a sign-in to that club.
    again = complete_signup("code", join, db).login.member
    assert again.id == joined.id


def test_company_join_links_still_refuse_a_second_org(db, monkeypatch):
    club, _president = _start_club(db, monkeypatch, email="me@acme.com", hd="acme.com")
    _company, _founder, _team, link = _seed_org_with_link(db, domain="acme.com")
    _google(monkeypatch, "me@acme.com", hd="acme.com")
    join = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"join_token": link.token})
    with pytest.raises(ValueError, match="another organization"):
        complete_signup("code", join, db)


def test_a_club_has_no_workspace_tasks_but_asks_for_a_club_account(db, monkeypatch):
    club, president = _start_club(db, monkeypatch)
    kinds = {t["kind"] for t in pending_tasks(club.id, president, db)}
    assert "club_account" in kinds
    assert not kinds & {"no_super_admin", "company_drive"}

    set_club_account(club.id, president, president.id, db)
    assert "club_account" not in {t["kind"] for t in pending_tasks(club.id, president, db)}


def test_only_a_club_member_can_be_its_club_account(db, monkeypatch):
    club, president = _start_club(db, monkeypatch)
    company, founder, _team, _ = _seed_org_with_link(db, domain="acme.com")
    with pytest.raises(ValueError):
        set_club_account(club.id, president, founder.id, db)
    with pytest.raises(ValueError):
        set_club_account(company.id, founder, founder.id, db)


def _m(email, auth):
    return OrgMember(id=uuid.uuid4(), organization_id=uuid.uuid4(), email=email, auth_type=auth)


def test_club_ownership_follows_googles_rules():
    ua = _m("a@ualberta.ca", AuthType.DOMAIN_DELEGATED)
    ua_club = _m("club@ualberta.ca", AuthType.DOMAIN_DELEGATED)
    other_school = _m("b@ucalgary.ca", AuthType.DOMAIN_DELEGATED)
    gmail = _m("c@gmail.com", AuthType.PERSONAL_OAUTH)
    gmail_club = _m("club@gmail.com", AuthType.PERSONAL_OAUTH)
    ok, no = TransferEligibility.ELIGIBLE, TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT
    assert _eligibility(ua, ua_club, club=True) == ok
    assert _eligibility(other_school, ua_club, club=True) == no
    assert _eligibility(gmail, gmail_club, club=True) == ok  # pending-owner handover
    assert _eligibility(ua, gmail_club, club=True) == no
    assert _eligibility(gmail, ua_club, club=True) == no
    # Companies are unchanged: Gmail never moves.
    assert _eligibility(gmail, gmail_club) == no


def test_the_club_librarian_only_suggests_files_with_club_evidence():
    members = {"pres@ualberta.ca", "alum@gmail.com"}
    mine = {"id": "f", "mimeType": "application/vnd.google-apps.document", "owners": [{"me": True}]}
    coursework = {**mine, "permissions": [{"type": "user", "role": "writer", "emailAddress": "prof@ualberta.ca"}]}
    club_doc = {**mine, "permissions": [{"type": "user", "role": "writer", "emailAddress": "alum@gmail.com"}]}
    edited = {**mine, "lastModifyingUser": {"me": False, "emailAddress": "pres@ualberta.ca"}}
    assert classify_club(coursework, members) is None
    assert classify_club(club_doc, members).suggestion == LibrarianSuggestion.COMPANY
    assert classify_club(edited, members).reasons == {"edited_by_coworker": 1}
    assert member_collaborator_emails(club_doc, members) == ["alum@gmail.com"]


# ------------------------------------- "What are you setting up?" (2026-10-14)

from app.onboarding.service import (  # noqa: E402
    create_from_pending,
    decode_pending_personal_signup_token,
    pending_signup_view,
)


def _new_account(db, monkeypatch, email, hd):
    _google(monkeypatch, email, hd=hd)
    result = complete_signup("code", build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE), db)
    assert result.login is None, "a new account answers the question before anything is created"
    return result.pending_personal_token


def test_a_new_workspace_account_is_asked_before_any_org_exists(db, monkeypatch):
    token = _new_account(db, monkeypatch, "sam@ualberta.ca", "ualberta.ca")
    assert decode_pending_personal_signup_token(token)["hd"] == "ualberta.ca"
    assert db.execute(select(Organization)).first() is None
    assert pending_signup_view(token, db) == {"domain": "ualberta.ca", "existing_organization_name": None}


def test_club_or_group_answer_never_claims_the_domain(db, monkeypatch):
    token = _new_account(db, monkeypatch, "sam@ualberta.ca", "ualberta.ca")
    member = create_from_pending(token, "club", db).member
    org = db.get(Organization, member.organization_id)
    assert org.kind == ORG_KIND_CLUB and org.observed_domain is None


def test_business_answer_joins_or_starts_the_domain_org(db, monkeypatch):
    company, _founder, _team, _ = _seed_org_with_link(db, domain="acme.com")
    token = _new_account(db, monkeypatch, "new@acme.com", "acme.com")
    assert pending_signup_view(token, db)["existing_organization_name"] == "Acme"
    assert create_from_pending(token, "business", db).member.organization_id == company.id


def test_business_answer_needs_a_work_account(db, monkeypatch):
    token = _new_account(db, monkeypatch, "me@gmail.com", None)
    with pytest.raises(ValueError, match="work account"):
        create_from_pending(token, "business", db)
