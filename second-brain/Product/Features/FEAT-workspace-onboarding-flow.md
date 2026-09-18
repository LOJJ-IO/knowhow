---
type: feature
status: draft
tags: [area/product, area/backend, area/frontend, auth]
created: 2026-09-16
updated: 2026-09-16
related: ["[[FEAT-drive-file-classification]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[FEAT-landing-login-panel]]", "[[Product-Vision]]"]
---

# FEAT: Workspace onboarding flow (sign-in → org → authority)

## Status
`draft` — direction agreed with the user 2026-09-16; not built. The Log In panel ([[FEAT-landing-login-panel]]) is the intended entry point.

## Problem
The person setting Knowhow up is often not the owner and not the Google Workspace Super Admin (e.g. an employee asked to set it up for a busy owner). Onboarding must not conflate **identity**, **organization membership**, **ownership**, and **Workspace admin authority** — and must not let anyone claim an organization by typing its name.

## Solution
1. **Continue with Google first** — nothing asked before auth. Gives verified identity + Workspace domain.
2. **Domain → organization.** Verified Workspace domain is the tenant identity. If it already has an org: "Acme is already on Knowhow. Ask your admin for access." — never create a second org for the domain.
3. **New domain → ask org name** (prefilled from domain, editable). Name is display metadata only; never used for membership or access.
4. **"Are you the owner / top of the organization?"** — No → owner's work email → owner confirms.
5. **"Are you a Google Workspace Super Admin?"** — asked separately. Setup person, owner and Super Admin may be three different people (Sarah / John / David).
6. A non-admin can start getting value immediately (their own authorized data); Workspace-wide features unlock when the Super Admin authorizes domain-wide delegation.

The owner confirms by **signing in with Google as the invited account** — the setup person never acts as the owner.

## Decisions (2026-09-16)
- **Frontend is mocked** ([[0001-mocked-data-first-prototype]]) — screens built against a local mock shaped like the backend's onboarding responses.
- **Domain check = two independent checks, both after Google sign-in:**
  1. *Does Google say this is a Workspace account?* — the `hd` claim on the verified ID token. Present → Workspace domain; absent → personal Google account (e.g. `gmail.com`). Never inferred from the email string.
  2. *Does Knowhow already have an org for that verified domain?* — lookup by `Organization.verified_domain`. Only runs when check 1 produced a domain.
- **Personal Gmail may use Knowhow** — consistent with the Company / Personal / External model ([[FEAT-drive-file-classification]]). A personal account is never a tenant key.
- **Use before establishment:** a person can use Knowhow before the org is fully established; the org can exist before Workspace-wide authorization.
- **No authority is inferred from another authority.** Identity ≠ membership ≠ ownership ≠ Super Admin ≠ Drive consent. Each is granted by its own proof.

| State                | Knowhow account | Org access | Individual Drive | Workspace-wide |
| -------------------- | --------------: | ---------: | ---------------: | -------------: |
| Before owner         |               ✅ |    Limited |      Potentially |              ❌ |
| Owner confirmed      |               ✅ |          ✅ |                ✅ |              ❌ |
| Super Admin approved |               ✅ |          ✅ |                ✅ |              ✅ |

- **Individual Google data access (2026-09-16):** requires authorization from *that* Google account **and** must satisfy the Workspace's app-access controls. Organization confirmation establishes organizational authority only — it never authorizes access to any user's Google data. Before ownership is confirmed, an individual may still authorize access to their own data if Google and the Workspace's app-access policies permit it. So the table's Individual Drive column means *may be authorized by that person*, not *granted by the state*; "Potentially" = subject to their consent + their Workspace's app-access policy.

## Out of scope
- Multi-domain organizations (`acme.com` + `acme.ca`) — `Organization.verified_domain` is a single unique column.
- File classification of the setup person's Drive — see [[FEAT-drive-file-classification]].

## UI/UX
Not designed. Entry is the Log In slide-up panel. Copy above is the agreed wording direction, not final copy — user designs screens.

## Technical approach
The backend already asks the two authority questions separately (`create_org_chart(is_owner, is_super_admin, owner_email)`, owner confirmation tokens) — see `backend/app/onboarding/service.py`. Gaps against this spec (as of 2026-09-16):
- **Blocked consent not handled** — no handling in `app/auth` for Google refusing authorization (e.g. the Workspace's app-access controls block Knowhow, or the user declines); the flow needs a distinct state for each.
- **No `hd` check anywhere** — `_infer_auth_type` guesses Workspace vs personal from the email string + a free-mail list.
- **No domain check at signup** — `complete_signup` bootstraps a new org for any unknown email; never looks up an existing org by domain.
- **`verified_domain` not set at signup** (null until delegation), and delegation derives it from the email string, not Google's `hd` (hosted-domain) ID-token claim. Only `hd` proves a Workspace account; `gmail.com` must never become a tenant.
- **Owner confirmation is possession-only** — `confirm_owner(token)` doesn't require the confirmer to be authenticated as `owner_email`.
- **Owner email unrestricted** — any address accepted.
- **Confirmation email never sent** — delivery marked out of scope in the service.

## Open questions
- **Domain squatting / recovery:** first signup holds the domain. How does the real org reclaim it (e.g. anyone who proves Workspace Super Admin)?
- **Two trust axes, not one:** capabilities before *owner confirmation* vs before *Super Admin authorization*. Candidate: before owner confirms — no assigning top roles, no offboarding/removing members. Before Super Admin — no Directory-sourced org chart, no reading others' Drive data, no ownership changes / Auto-Own / domain-wide operations. Manual org chart + invites allowed early.
- **Owner declines** ("that's not me") path, and letting the setup person re-nominate.
- ~~Owner outside the domain / non-Workspace users~~ — personal Gmail allowed (2026-09-16). Still open: can a personal-Gmail user *create* an org (no domain to key it by), or only join/be named owner of one?
- ~~"Individual Drive" row~~ — resolved 2026-09-16 (see Decisions).
- **"Limited" org access before owner** — the candidate list below is not yet confirmed.
- Notify Workspace admins when an org is created for their domain?

## Related
[[0004-fastapi-backend-for-auth-and-identity]] · [[FEAT-drive-file-classification]] · [[FEAT-landing-login-panel]]
