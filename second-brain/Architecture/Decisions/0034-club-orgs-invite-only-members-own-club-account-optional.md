---
type: decision
status: active
tags: [area/backend, area/product, multi-tenant, auth]
created: 2026-10-13
updated: 2026-10-13
related: ["[[0006-observed-domain-tenant-identity]]", "[[0021-founder-not-owner-leads-self-claim]]", "[[0024-own-drive-consent-for-work-accounts]]", "[[0025-linked-personal-drive-visible-to-owner]]", "[[0032-librarian-files-on-its-own-and-reports]]", "[[Current-Context]]"]
---

# ADR-0034: Club orgs: invite-only, no domain; members own their files, a club account can own them

## Status
`active`. Decided by the user 2026-10-13 ("a mixture of A and B"). Not built yet.

## Context
University clubs (UAlberta first; a likely ICP) don't have their own Google Workspace domain. Two of Knohow's rules break for them:

1. **One org per observed domain** ([[0006-observed-domain-tenant-identity]]). Members sign in as `@ualberta.ca`, shared with the whole university. The first club would claim "ualberta.ca", and every other club would try to join it.
2. **The org owns files through domain-wide delegation.** The `ualberta.ca` Super Admin is university IT, who won't approve a student club's app. With no delegation, Knohow can't act on everyone's Drive or own files as the org.

What the user told us about clubs (2026-10-13): students use their **school accounts** (`@ualberta.ca`), and a club usually already has a **general/admin account** for its correspondence, usually a `@ualberta.ca` Google account too.

## Decision
A new kind of organization, the **club org**:

- **Not tied to a domain.** It never claims or reserves an observed domain, and you only get in through its **join link**, never automatically by email domain. Any Google account can join (`@ualberta.ca` or Gmail).
- **People can be in several clubs**: one row per club in the Log In account picker (already how sign-in works, [[0013-sign-in-is-to-an-organization]]).
- **Each member connects their own Drive** (the per-person consent from [[0024-own-drive-consent-for-work-accounts]]); there is no Super Admin / delegation step.
- **Ownership, A + B:**
  - **A (default):** members keep owning their files. Knohow files, shares (team rules) and searches them.
  - **B (when the club sets one up):** the club connects its **club account** (its general/admin Google account, which also connects its Drive). Ownership moves to the club account where Google allows it:
    - same Workspace domain (`@ualberta.ca` → `@ualberta.ca` club account): a direct transfer by the file's owner, through their own consent;
    - Gmail → Gmail: a pending-owner transfer the club account accepts (Knohow accepts as the club account);
    - across the boundary (`@ualberta.ca` ↔ Gmail): Google won't transfer, so the club account gets an editor share and the file is listed as stuck (the existing `UnresolvedOwnership` path); offered as a copy, like importing a personal file.
  - Offboarding a graduating exec hands their files to the club account (or, without one, to whoever takes over, via the same rules).

## Alternatives considered
- **A only (members always own)**: rejected as the whole story. It leaves the club's main pain, files leaving with graduating execs, unsolved.
- **B only (club account must own everything)**: rejected as a requirement. Clubs get value before they set up a club account, and cross-domain files can't move anyway.
- **C: club buys its own Workspace domain**: still works (it's then an ordinary Knohow org), but too costly and fiddly to require of student clubs.
- **Treat `ualberta.ca` as a normal observed-domain org with clubs as teams**: rejected. Clubs are separate organizations with separate execs, and nobody can get delegation for `ualberta.ca`.

## Consequences
- **Needs Google OAuth verification for the `drive` scope at scale.** Every club member consents individually, so the unverified-app cap (100 test users) and "Access blocked" apply to all of them. Verification (with its security assessment) must start before clubs can onboard beyond a pilot.
- Org model: an org `kind` (company vs club), with clubs exempt from the one-org-per-domain rule and from domain-locking at sign-up and join.
- Setup flow for clubs skips the Workspace / Super Admin / delegation steps and adds "Connect your club account" (optional).
- Features needing the Admin console degrade for clubs: the org-wide activity feed (Reports API) isn't available; detection relies on each member's Drive.
- Auto-Own and offboarding gain a club-account target and per-pair transfer rules above.

## Related
[[0006-observed-domain-tenant-identity]] (amended: club orgs are exempt) · [[0021-founder-not-owner-leads-self-claim]] · [[0024-own-drive-consent-for-work-accounts]] · [[0025-linked-personal-drive-visible-to-owner]] · [[0032-librarian-files-on-its-own-and-reports]]
