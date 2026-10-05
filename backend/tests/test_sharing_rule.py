"""A team's customisable sharing rule (Ronald, 2026-10-04): who new files
go to, at what access, and who owns them."""

import uuid

import pytest
from fastapi import HTTPException

from app.api.routes.governance import SharingRuleBody, save_sharing_rule
from app.models.org_member import AuthType
from app.models.org_membership import OrgMembership, OrgRole
from app.models.team import Team
from app.sharing.service import _auto_own_target, share_role_for
from app.sharing.visibility import resolve_auto_share_recipients
from tests.test_librarian import D, _member, _org, db  # noqa: F401  (db is a fixture)


def _second_team(db, org):
    sales = Team(id=uuid.uuid4(), org_id=org.id, name="Sales")
    db.add(sales)
    db.flush()
    seller = _member(db, org, f"seller@{D}")
    db.add(OrgMembership(org_id=org.id, team_id=sales.id, user_id=seller.id, role=OrgRole.MEMBER))
    db.commit()
    return sales, seller


def test_default_rule_is_the_team(db):
    org, lead, worker, team = _org(db)
    assert resolve_auto_share_recipients(org.id, team.id, db) == {lead.id, worker.id}
    assert share_role_for(team.id, db) == "writer"
    assert _auto_own_target(org.id, team.id, db).id == lead.id


def test_saved_rule_changes_recipients_role_and_owner(db):
    org, lead, worker, team = _org(db)
    sales, seller = _second_team(db, org)
    outsider = _member(db, org, f"guest@{D}")
    body = SharingRuleBody(
        top_leaders=False,
        extra_member_ids=[outsider.id],
        extra_team_ids=[sales.id],
        excluded_member_ids=[worker.id],
        role="commenter",
        owner_override_id=worker.id,
    )
    saved = save_sharing_rule(org.id, team.id, body, db, lead)
    assert saved["role"] == "commenter"
    db.refresh(team)
    assert resolve_auto_share_recipients(org.id, team.id, db) == {lead.id, outsider.id, seller.id}
    assert share_role_for(team.id, db) == "commenter"
    assert _auto_own_target(org.id, team.id, db).id == worker.id

    # Picking the lead again means "follow the lead".
    save_sharing_rule(org.id, team.id, body.model_copy(update={"owner_override_id": lead.id}), db, lead)
    db.refresh(team)
    assert team.owner_override_id is None


def test_only_owner_admin_or_lead_and_no_personal_owner(db):
    org, lead, worker, team = _org(db)
    body = SharingRuleBody(top_leaders=True)
    with pytest.raises(HTTPException) as e:
        save_sharing_rule(org.id, team.id, body, db, worker)
    assert e.value.status_code == 403
    personal = _member(db, org, "someone@gmail.com")
    personal.auth_type = AuthType.PERSONAL_OAUTH
    db.commit()
    with pytest.raises(HTTPException) as e:
        save_sharing_rule(org.id, team.id, body.model_copy(update={"owner_override_id": personal.id}), db, lead)
    assert e.value.status_code == 422
    with pytest.raises(HTTPException):
        save_sharing_rule(org.id, team.id, body.model_copy(update={"role": "owner"}), db, lead)
