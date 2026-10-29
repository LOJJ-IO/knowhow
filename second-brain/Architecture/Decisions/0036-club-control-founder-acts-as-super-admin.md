---
type: decision
status: proposed
tags: [area/backend, area/product, multi-tenant, auth, clubs]
created: 2026-10-28
updated: 2026-10-28
related: ["[[0034-club-orgs-invite-only-members-own-club-account-optional]]", "[[0021-founder-not-owner-leads-self-claim]]", "[[0035-team-outside-links-any-google-account]]", "[[0006-observed-domain-tenant-identity]]", "[[Current-Context]]"]
---

# ADR-0036: Who controls a club: the founder acts as its Super Admin, and the club's own account is the expected way in

## Status
`proposed` (Tolu, 2026-10-28). Direction from Tolu's thinking, not built. Needs Ronald's review and a yes before any code.

## Context
A club has no Google Workspace domain, so it has no Super Admin, ever ([[0034-club-orgs-invite-only-members-own-club-account-optional]]). Every management check in the backend is "owner or verified Super Admin" (`_manages_org` in `routes/governance.py`, `members/outside.py`, `_require_owner` in `onboarding/service.py`). In a club the owner is whoever the founder names, often nobody at first. So the person who made the club can't manage sharing, ownership or approvals unless they are also the owner.

Tolu's observation: a club usually has **one dedicated Gmail or `@ualberta.ca` account** for its correspondence, and that account gets handed on, one way or another, from one exec team to the next, "even if it's 'I graduated, here's the password'". So the likeliest way a club sets up Knohow is by signing in as that account.

## Decision (proposed)
- **The person who first creates the club acts as its Super Admin**, whether or not they are the owner. They confirm who the owner is and can change it. No Google proof exists for a club, so this stands in for the verified Super Admin the code already checks for.
- **The club's own account is the expected setup identity.** Setting Knohow up as the club account means whoever holds that account next year holds the founder's powers, which is how clubs already hand things over. It also lines up with the optional club-account ownership target in ADR-0034: the founder and the club account are often the same person-slot.
- Other members stay as they are (team leads manage their own team).

## Open questions
- **Founder and club account are different people.** Which one controls? Proposal: the founder, and they can move the role to the club account in Settings.
- **Handing over.** Passing the password works until Google asks for a code. A "transfer founder" action (current founder or owner names a new one) would avoid depending on that.
- **How to build it.** Setting `super_admin_verified_at` for a club founder would pass every existing check, but "verified" means Google-proven and other code reads it (admin proof, delegation). A club-aware helper (`manages_org` that also accepts the founder when `org.is_club`) is cleaner, at the cost of touching the ~30 call sites. Not decided.
- Server-side gap found on the way: `PATCH /organizations/{org}/teams/{team}` (rename, auto-own) only checks same-org membership, so any member could call it. The Sharing screen already greys the controls out for teams you don't lead.

## Consequences (if accepted)
- Clubs get one clear controller from the first minute, with no Google step.
- A new ADR would supersede the club-control part of ADR-0034 and amend ADR-0021 for clubs.
- Needs tests: a club founder who isn't owner can approve members, set the owner and edit every team's sharing rule; a plain member can't.

[[0034-club-orgs-invite-only-members-own-club-account-optional]] · [[0021-founder-not-owner-leads-self-claim]] · [[0035-team-outside-links-any-google-account]]
