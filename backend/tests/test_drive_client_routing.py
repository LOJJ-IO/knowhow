"""Which Drive client a member gets (ADR-0024): company connection first,
their own consent as the fallback for domain members, never the reverse."""

from types import SimpleNamespace

import pytest

from app.exceptions import DelegationNotApproved, PersonalAccountNotConsented
from app.google import drive_client
from app.models.org_member import AuthType


def _member(auth_type, consented):
    return SimpleNamespace(
        auth_type=auth_type,
        oauth_credential=object() if consented else None,
        id="m",
        organization_id="o",
    )


@pytest.fixture
def clients(monkeypatch):
    calls = []

    def delegated(member, db):
        calls.append("delegated")
        if not member.delegation_ok:
            raise DelegationNotApproved("no grant")
        return "delegated-client"

    def personal(member, db):
        calls.append("personal")
        if member.oauth_credential is None:
            raise PersonalAccountNotConsented("m")
        return "personal-client"

    monkeypatch.setattr(drive_client, "_domain_delegated_client", delegated)
    monkeypatch.setattr(drive_client, "_personal_oauth_client", personal)
    return calls


def test_domain_member_uses_company_connection_when_approved(clients):
    member = _member(AuthType.DOMAIN_DELEGATED, consented=True)
    member.delegation_ok = True
    assert drive_client._client_for(member, None) == "delegated-client"
    assert clients == ["delegated"]


def test_domain_member_falls_back_to_own_consent(clients):
    member = _member(AuthType.DOMAIN_DELEGATED, consented=True)
    member.delegation_ok = False
    assert drive_client._client_for(member, None) == "personal-client"


def test_domain_member_without_either_is_not_connected(clients):
    member = _member(AuthType.DOMAIN_DELEGATED, consented=False)
    member.delegation_ok = False
    with pytest.raises(DelegationNotApproved):
        drive_client._client_for(member, None)


def test_personal_member_never_uses_delegation(clients):
    member = _member(AuthType.PERSONAL_OAUTH, consented=False)
    member.delegation_ok = True
    with pytest.raises(PersonalAccountNotConsented):
        drive_client._client_for(member, None)
    assert clients == ["personal"]
