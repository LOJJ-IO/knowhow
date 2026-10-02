"""The sales sandbox: one fixed organization ("Acme") that anyone can enter
from GET /sandbox/enter, signed in as its owner, with a full company's worth
of teams, people and files.

It is fenced off from everything real:
- Its members never reach Google. `get_drive_client_for_user` hands them an
  in-memory Drive (`app.sandbox.drive.SandboxDrive`), and every job that
  checks Google skips the org.
- It has no domain of its own (observed/verified domain stay NULL), so no
  real Google sign-in can ever be matched or joined into it; its invitations
  and join links are never honoured at sign-in.
- It sends no email (nothing in the app emails members).
"""

import uuid

SANDBOX_ORG_ID = uuid.UUID("5a4db0c5-0000-4000-8000-00000000ac3e")
# What the sandbox's people and files look like they belong to. Display only:
# the organization row itself stays domainless (see above).
SANDBOX_DOMAIN = "acme.com"


def is_sandbox_org(org_id: uuid.UUID | None) -> bool:
    return org_id == SANDBOX_ORG_ID
