---
type: decision
status: active
tags: [area/backend, area/product, auth, multi-tenant]
created: 2026-09-17
updated: 2026-09-17
related: ["[[FEAT-workspace-onboarding-flow]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[FEAT-drive-file-classification]]", "[[Architecture-Overview]]"]
---

# ADR-0006: Tenant identity is the observed domain; verification upgrades authority in place

## Status
`active` — decided with the user 2026-09-17 while specifying [[FEAT-workspace-onboarding-flow]]. Not implemented (frontend is mocked per [[0001-mocked-data-first-prototype]]; backend gaps listed in the spec).

## Context
Onboarding must not let anyone claim an organization by typing its name, and the person setting Knowhow up is usually not the owner and not a Workspace Super Admin. Two facts forced this decision:

1. **Google's `hd` claim proves membership, not control.** An ordinary employee signing in with `sarah@acme.com` demonstrates the account belongs to that Workspace — nothing about authority over it. So an ordinary employee's signup cannot bind a domain.
2. **If a domain is only bound by proof, nothing identifies the tenant at signup.** Matching orgs on `verified_domain` alone would let every Acme employee bootstrap a parallel org that never converges — the organization fragments before an admin ever appears.

The backend currently sits at the wrong end of both: `complete_signup` bootstraps a new org for any unknown email, and `approve_delegation()` sets `verified_domain` from the admin's *attestation* that they completed the Admin console step ("records the client's attestation, not a proof" — its own docstring).

## Decision
**Observation creates the organizational candidate; verification upgrades it.**

- The domain observed in Google's `hd` claim at signup creates an organizational **candidate** — a real org, with no authority derived from the domain.
- **At most one active Knowhow organization may exist per observed domain**, whether or not that domain is verified.
- Every org therefore **starts unbound** (no `verified_domain`) and binds a domain only when an admin arrives and passes **admin proof** — an admin-only Google call succeeding under that person's own authorization.
- **Verification changes the authority state of that same organization in place.** It never creates a second org, and never splits, reassigns or reclassifies its existing members.
- A personal Google account (no `hd`) creates a **domainless** org instead: one owner, and one active domainless org per person.

## Alternatives considered
- **Bind the domain at signup from `hd`** — rejected: `hd` is membership, not control. Any employee could bind their employer's domain, and a `gmail.com` account could become a tenant.
- **Match orgs on `verified_domain` only** — rejected: with no domain bound at signup, every employee gets their own org and the real organization fragments.
- **Trust the self-declared "I'm a Super Admin" answer** — rejected: self-declaration is not evidence. The answer routes the flow; Google grants the authority.
- **DNS TXT verification** (Google's own model for domain ownership) — not rejected on merit, but likely unnecessary: if authority comes from Workspace admin proof, a domain with no Workspace behind it has no Workspace to control, and such an org can stay domainless. Left open in the spec.
- **Re-derive members' auth type when a domain binds** — rejected: it would infer per-member authority from an org-level event, violating "no authority is inferred from another authority". Each member's Google data access follows from their own authorization.

## Consequences
- **Requires an `observed_domain` concept the backend does not have.** Uniqueness must be enforced over *active* orgs per observed domain — `Organization.verified_domain` is a plain unique column with no notion of "active", so neither half is expressible today.
- **Domain binding becomes a distinct, provable event**, separate from both signup and owner confirmation — and `approve_delegation()`'s attestation path must stop being what sets `verified_domain`.
- **The onboarding UI needs an unbound state**: a working org whose Workspace-wide features are visibly locked until an admin arrives.
- **Identity linking becomes load-bearing (2026-09-17).** Standing is per *person*, raised by their highest-vouched linked email, so a Gmail founder links their Workspace account rather than a second org appearing. The backend keys members by a single email (`OrgMember.email`, org-agnostic lookup in `complete_signup`) with no notion of one person holding several — and linking must be proven by signing in, never typed.
- **No merge path** between a domainless org and an already-created candidate for the same company: a domainless org reserves no domain, so the collision is possible and nothing repairs it.
- **New questions the rule doesn't answer** (tracked in [[FEAT-workspace-onboarding-flow]]): how a second employee *joins* an existing candidate and with what standing; what makes an org "active"; how an abandoned candidate releases its domain; and domain-squatting recovery.
- Admin proof is a live Google call, so it can fail for reasons that aren't refusal (Workspace app-access controls, revoked consent) — those need their own states, not a generic error.

## Related
[[FEAT-workspace-onboarding-flow]] · [[0004-fastapi-backend-for-auth-and-identity]] · [[FEAT-drive-file-classification]] (Company / Personal / External) · [[0001-mocked-data-first-prototype]]
