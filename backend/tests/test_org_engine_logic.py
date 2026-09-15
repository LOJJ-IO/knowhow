import uuid

from app.models.org_member import AuthType, OrgMember
from app.onboarding.service import _email_domain, _infer_auth_type
from app.search.deepsearch import _escape_drive_query
from app.transfers.service import _eligibility
from app.models.transfer_batch import TransferEligibility


def _member(auth_type: AuthType) -> OrgMember:
    return OrgMember(id=uuid.uuid4(), organization_id=uuid.uuid4(), email="x@example.com", auth_type=auth_type)


def _org(verified_domain: str | None):
    class _Org:
        pass

    org = _Org()
    org.verified_domain = verified_domain
    return org


def test_email_domain_lowercased():
    assert _email_domain("Person@Example.COM") == "example.com"


def test_infer_auth_type_matches_verified_domain():
    org = _org("acme.org")
    assert _infer_auth_type("person@acme.org", org) == AuthType.DOMAIN_DELEGATED
    assert _infer_auth_type("person@gmail.com", org) == AuthType.PERSONAL_OAUTH


def test_infer_auth_type_falls_back_to_free_email_heuristic_when_domain_unverified():
    org = _org(None)
    assert _infer_auth_type("person@gmail.com", org) == AuthType.PERSONAL_OAUTH
    assert _infer_auth_type("person@acme.org", org) == AuthType.DOMAIN_DELEGATED


def test_transfer_eligible_only_when_both_sides_domain_delegated():
    domain_a = _member(AuthType.DOMAIN_DELEGATED)
    domain_b = _member(AuthType.DOMAIN_DELEGATED)
    personal = _member(AuthType.PERSONAL_OAUTH)

    assert _eligibility(domain_a, domain_b) == TransferEligibility.ELIGIBLE
    assert _eligibility(personal, domain_b) == TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT
    assert _eligibility(domain_a, personal) == TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT
    assert _eligibility(None, domain_b) == TransferEligibility.INELIGIBLE_PERSONAL_ACCOUNT


def test_escape_drive_query_handles_quotes_and_backslashes():
    assert _escape_drive_query("O'Brien") == "O\\'Brien"
    assert _escape_drive_query("back\\slash") == "back\\\\slash"
