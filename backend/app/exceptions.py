class KnohowError(Exception):
    """Base class for all typed application errors."""


class CrossOrgAccessDenied(KnohowError):
    """Raised when a request for one organization's delegation attempts to touch
    a user or resource belonging to a different organization. This must never be
    caught and silently ignored — it indicates either a bug or an active
    tenant-isolation violation."""


class DelegationNotApproved(KnohowError):
    """Raised when domain-wide delegation impersonation is attempted for an
    organization whose DelegationGrant is not in the `approved` state."""


class PersonalAccountNotConsented(KnohowError):
    """Raised by get_drive_client_for_user when a personal-account member has not
    yet completed the individual OAuth consent flow. Callers must surface this to
    the user as an explicit "connect your Google account" prompt — never fall
    back to the delegation path, which cannot reach personal Gmail accounts."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(f"OrgMember {user_id} has not completed personal OAuth consent")


class OwnershipTransferNotPermitted(KnohowError):
    """Raised when ownership transfer is attempted to or from a personal-account
    member. This is a hard Google platform limitation (Drive ownership transfer
    only works within a single Workspace domain), not a bug to work around."""


class MemberNotProvisioned(KnohowError):
    """Raised on login when no OrgMember row exists for the authenticated
    Google account. Creating that row is owned by the org onboarding flow
    (the org-engine module built on top of this one) — this module only
    authenticates identities that already exist."""

    def __init__(self, email: str):
        self.email = email
        super().__init__(f"no OrgMember found for {email}")


class AuditChainBroken(KnohowError):
    """Raised internally when a break in an organization's audit hash chain is
    detected during a write. Reads use verify_audit_chain() instead, which
    reports the break rather than raising."""
