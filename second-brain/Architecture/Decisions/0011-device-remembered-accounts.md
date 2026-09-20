---
type: decision
status: active
tags: [area/backend, area/frontend, auth, privacy]
created: 2026-09-20
updated: 2026-09-20
related: ["[[0006-observed-domain-tenant-identity]]", "[[0008-continue-with-google-via-backend]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-landing-login-panel]]", "[[Architecture-Overview]]", "[[Known-Issues]]"]
---

# ADR-0011: Remembered accounts are scoped to a browser, not to a person

## Status
`active` (2026-09-20)

## Context
The user asked for a Canva-style account picker on Log In — "Which account today?", listing
previously used accounts. Knohow could not do this: sign-in is a full-page redirect to the
backend and on to Google ([[0008-continue-with-google-via-backend]]), the backend keeps a
single access/refresh cookie pair, and nothing recorded who had signed in before.

The tempting framing — "list this person's accounts" — is not available to us. **Identity
linking is unbuilt**: Knohow has no way to know that two Google accounts belong to the same
human, and [[0006-observed-domain-tenant-identity]] is explicit that standing is per person
but proven only by signing in, with data kept per account. A picker that implied "these are
your accounts" would be asserting an identity link the system cannot support.

A related premise was corrected during the discussion. A personal Gmail is **not** always its
own domainless org: `complete_signup` does an org-agnostic email lookup first, so if that
email is already an `OrgMember` anywhere, signing in is just a login. A personal account that
belongs to a company org feeds that org, reaching Drive through the personal-OAuth path
(`_infer_auth_type`, `app/auth/personal_oauth.py`) because delegation cannot reach a Gmail
account. Contractors and Gmail-based companies both live here. So "work vs personal" is the
wrong axis for the picker; **which org a row resumes into** is the real one.

## Decision
Remembered accounts are keyed to an **opaque device id** in a long-lived `knohow_device`
cookie on the backend origin, never to a person. A `remembered_accounts` row records only
that *this browser* signed in as *this member*, with `last_seen_at` for ordering.

The list confers **nothing**. Choosing a row starts an ordinary Google sign-in and merely
passes the email as `login_hint` (`/onboarding/signup?email=…`), which pre-selects the
account at Google; Google still decides who signs in. An invitation's own email always wins
over the hint.

## Alternatives considered
- **Browser `localStorage`** — rejected: per-device anyway, but it would have put names and
  emails in storage the backend can neither audit nor clear, and it cannot resolve which org
  an account belongs to.
- **Key the list to a person** — rejected: requires identity linking, which is unbuilt and is
  a separate decision. This ADR deliberately does not create a backdoor version of it.
- **List only Workspace (`hd`) accounts** — rejected after the correction above: personal
  accounts are frequently legitimate members of a company org, so filtering them out would
  hide real sessions.
- **Always show the organization on every row** — rejected as noise. The org line appears
  only when the remembered accounts span more than one org (user, 2026-09-20).

## Consequences
- The picker is empty in a fresh browser, in incognito, and after clearing cookies, so the
  existing "Log in or sign up in seconds" screen **remains the fallback** and cannot be removed.
- A shared computer accumulates several people's names and emails in one picker. That is what
  **"Remove accounts"** (`DELETE /auth/remembered-accounts`) is for: it forgets every account
  on that browser and drops the device cookie. Members and orgs are untouched.
- `knohow_device` deliberately **survives logout** — otherwise the picker could never offer
  the account it exists to offer.
- **Privacy Policy impact:** this introduces a durable browser identifier holding names and
  emails before sign-in. The `/auth/remembered-accounts` read is unauthenticated by necessity
  (it runs before there is a session), so the device cookie is the only thing gating it —
  it returns only what that browser itself did, never an org's membership. The policy does not
  yet describe this cookie; tracked in [[Known-Issues]] alongside the existing `[legal / privacy]`
  launch blocker.
- Remembering is best-effort: a failure is logged (`auth.remember_account_failed`) and never
  breaks a sign-in.

## Related
- Backend: `app/models/remembered_account.py`, `app/auth/remembered.py`,
  `app/api/routes/auth.py`, migration `0008_remembered_accounts`, `tests/test_remembered_accounts.py`
- Frontend: `AccountPicker` in `src/components/brand/landing-hero.tsx` — [[FEAT-landing-login-panel]]
- Identity linking remains unbuilt — see [[FEAT-workspace-onboarding-flow]].
