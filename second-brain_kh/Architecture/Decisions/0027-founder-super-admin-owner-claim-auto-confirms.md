---
type: decision
status: active
tags: [onboarding, ownership, super-admin]
created: 2026-09-29
updated: 2026-09-29
related: ["[[0021-founder-not-owner-leads-self-claim]]", "[[0023-founder-setup-google-check-before-owner]]", "[[0026-notifications-tasks-and-updates]]"]
---

# ADR-0027: A founder who is the verified Super Admin is confirmed as owner automatically

## Status
`active`. Narrows ADR-0021's "an owner claim is a claim, never a grant" for one case.

## Context
An owner claim is confirmed by the founder or a verified Super Admin, and never by the claimant (ADR-0021, tasks in ADR-0026). A founder who passed Google's Super Admin check and then said "Yes, I sit at the top" (ADR-0023 order) is the claimant **and** every possible confirmer. Nobody got the confirm task and the claim waited forever. Home showed "Owner · awaiting confirmation" with nothing in Pending (seen 2026-09-29).

## Decision
When the claimant is the organization's founding member **and** a Google-verified Super Admin, the claim is confirmed immediately: `owner_member_id` set, no pending claim, audit `onboarding.owner_claim_confirmed` with `details.automatic = true`. This is checked both when the claim is made (`claim_pending_owner` returns `"owner"`) and when the Super Admin proof succeeds after a claim (`confirm_founder_admin_owner_claim`, called from `admin_proof.py`). Everyone else's claim still waits for someone other than themselves. Chosen by the user (2026-09-29) over "show them their own confirm task" and "wait for another Super Admin".

## Consequences
- Google's Super Admin proof counts as enough evidence for the founder's own claim.
- A founder who is **not** a verified Super Admin still can't confirm their own claim and waits for a Super Admin.
- Tests: `test_founder_super_admin_owner_claim_confirms_itself`, `test_founder_claim_before_admin_proof_is_confirmed_on_proof` (`backend/tests/test_tasks.py`). Backend 171 passed.
- The one stuck local claim (admin@knohow.app) was confirmed through the same function on 2026-09-29.
