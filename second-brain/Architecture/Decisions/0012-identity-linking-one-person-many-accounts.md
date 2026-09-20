---
type: decision
status: active
tags: [area/backend, area/frontend, auth, identity]
created: 2026-09-20
updated: 2026-09-20
related: ["[[0006-observed-domain-tenant-identity]]", "[[0011-device-remembered-accounts]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-landing-login-panel]]", "[[Architecture-Overview]]"]
---

# ADR-0012: Identity linking — one person, one org account, many personal accounts

## Status
`active` (2026-09-20), but **partly revised the same day by
[[0013-sign-in-is-to-an-organization]]**: the "one Workspace account per person" rule (decision 2)
and the person-shaped picker row are both replaced there. Everything else below still holds:
links are made and never inferred, data stays per account, there is no account picking. Builds on [[0011-device-remembered-accounts]], which deliberately
avoided identity linking; the user then asked for it directly.

## Context
The Log In picker built under [[0011-device-remembered-accounts]] listed one row per **account**,
so the same human appeared several times with their name repeated. The user asked for one row
per **person**, with badges beside the name saying what's attached — which requires knowing that
two Google accounts are the same human. That is identity linking, listed as "next pass" in
[[FEAT-workspace-onboarding-flow]] and explicitly out of scope in ADR-0011.

The user chose to build it rather than approximate it.

## Decision
A **`Person`** groups the `OrgMember` rows one human signs in with.

1. **Links are made, never inferred.** An account joins a person only when someone already
   signed in chooses "add another account" and completes a Google sign-in as it
   (`/auth/link-account/start` → shared `/auth/callback`, state purpose `link_account`).
   This is the spec's "standing is per person, proven by signing in". **Matching display names
   and shared browsers prove nothing and are never used** — the picker groups on `person_id`
   alone, so two colleagues called "Ronald" stay two rows.
2. **One org account, many personal** (user, 2026-09-20). A person holds at most one
   domain-delegated (Workspace) account, enforced both in the service and by a **partial unique
   index** `uq_person_one_org_account`. A contractor working for two companies cannot be
   represented — accepted knowingly.
3. **`personal` means any non-Workspace account** (user, 2026-09-20), whichever org it belongs
   to. A contractor's Gmail inside a company org therefore reads as *personal*, even though its
   data feeds that org through the personal-OAuth path.
4. **Data stays per account.** A Person groups; it never merges orgs, files or standing.
5. **There is no account picking.** A row is a person; clicking signs in as them, passing their
   most recently used account as Google's `login_hint`. Google can still override it. (User,
   2026-09-20: *"account picking doesn't exist"*.)
6. **Linking a claimed account is refused,** not resolved: if the account already belongs to a
   different person that has other accounts, the attempt fails (`AccountAlreadyLinked`). A
   person existing only to hold that one account is absorbed. Unpicking a wrong link is worse
   than refusing to make one.

## Alternatives considered
- **Group by display name** — rejected: "Ronald" and "Ronald Wopara" wouldn't group, and two
  different people sharing a name would wrongly merge. A test now guards against it.
- **Group per browser (device)** — rejected: that's [[0011-device-remembered-accounts]]'s scope
  and asserts nothing about identity; it cannot survive a new device.
- **Let the viewer link them on this device only** — rejected by the user in favour of the real
  backend feature.
- **Allow many org accounts per person** — rejected by the user ("one org, many personal").

## Consequences
- The picker collapses several accounts into one row, so the repeated name is gone.
- `org_members.person_id` is nullable for rows created before this existed; every sign-in
  backfills it via `person_for`. Unlinked rows stand alone in the picker rather than guessing.
- The contractor-at-two-companies case is now explicitly unrepresentable; revisit with a new
  ADR if it becomes real (it is plausible given [[0009-contractor-work-created-as-the-org]]).
- **No UI exists yet for creating a link.** The endpoint is built and returns `?link=linked |
  already_linked | has_org_account`, but nothing in the frontend calls it or shows the result —
  so in practice every person still has exactly one account until that screen is designed.
- `complete_login` now takes an `expected_purpose` so the link flow can reuse it.

## Related
- Backend: `app/models/person.py`, `app/auth/identity.py`, `app/auth/remembered.py`,
  `app/api/routes/auth.py`, migration `0009_identity_linking`, `tests/test_identity_linking.py`
- Frontend: `AccountPicker` / `AccountBadge` in `src/components/brand/landing-hero.tsx`
