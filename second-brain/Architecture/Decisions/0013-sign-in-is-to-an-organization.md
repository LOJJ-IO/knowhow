---
type: decision
status: active
tags: [area/backend, area/frontend, auth, identity, onboarding]
created: 2026-09-20
updated: 2026-09-20
related: ["[[0011-device-remembered-accounts]]", "[[0012-identity-linking-one-person-many-accounts]]", "[[0006-observed-domain-tenant-identity]]", "[[FEAT-landing-login-panel]]", "[[FEAT-workspace-onboarding-flow]]"]
---

# ADR-0013: Signing in is signing in to an organization

## Status
`active` (2026-09-20). **Revises [[0012-identity-linking-one-person-many-accounts]]** the same day:
identity linking stands, but its "one Workspace account per person" rule and its person-shaped
picker row are both replaced here. 0012 stays `active` for everything else.

## Context
[[0012-identity-linking-one-person-many-accounts]] made the Log In picker one row per **person**,
with the org and personal accounts as chips. The user then saw two rows reading the same name and
restated the model: *"when people are signing in, they're signing in as an organization"*.

## Decision
1. **A picker row is an organization**, not a person. Two companies plus a personal workspace is
   **three rows**. The **org's name leads**; the person's name is small subtext beneath it.
   (This is why the repeated-name problem disappears: the name was never meant to be the
   headline.)
2. **A person may belong to several organizations.** 0012's partial unique index
   `uq_person_one_org_account` is dropped (migration `0010_many_orgs_per_person`). Two companies
   is legitimate, which also unblocks the contractor case 0012 had knowingly excluded.
3. **A personal account is asked whether it has an organization account.**
   - **Yes** → they sign in to the work account and the personal address is recorded against the
     same person. **No personal org is created** for them.
   - **No** → they **name their own workspace**, and that name is what the picker shows for
     that row.
4. **A verified address with no membership is still worth keeping.** Because (3) creates no
   personal org, there is no `OrgMember` to link, so `person_emails` stores the proven address
   against the person. It is a record of identity and grants nothing.
5. **No em dashes in user-facing copy, ever** (user, 2026-09-20). Applied across the sheet and
   the legal page titles.

## Alternatives considered
- **Keep one row per person, orgs as chips** — rejected by the user; it buries the org, which is
  the thing being signed in to.
- **Group orgs under a person heading** — rejected as the busiest option.
- **Keep a personal org when linking to a work account** — rejected: someone who says "I have a
  work account" is asking for the company, and an empty personal workspace would be left behind.
- **Auto-name the personal org from the Google display name** — rejected; the user wants the
  person to name it, since that name is what they'll see at every future sign-in.

## Consequences
- `/auth/remembered-accounts` returns `organizations[]` (`member_id`, `organization_name`,
  `person_name`, `email`, `kind`), replacing 0012's `people[]` shape.
- The same person can appear on several rows. That is intended, and the org name plus subtext is
  what tells them apart.
- **Recognising a stored `person_emails` address at a later sign-in is not wired.** Someone who
  linked a personal address and then signs in with it again will still be treated as a new
  personal signup. Next obvious gap, alongside the still-missing UI for creating a link from
  inside the app.
- `create_domainless_org` takes an optional `name`; older callers keep the Google-name fallback.

## Related
- Backend: `app/auth/identity.py`, `app/auth/remembered.py`, `app/models/person_email.py`,
  `app/api/routes/onboarding.py` (`/onboarding/link-org-account`), migrations
  `0010_many_orgs_per_person`, `0011_person_emails`, `tests/test_identity_linking.py`
- Frontend: `AccountPicker` / `AccountBadge` / the personal-account screens in
  `src/components/brand/landing-hero.tsx`
