---
type: feature
status: in-progress
tags: [area/product, area/backend, area/frontend, auth]
created: 2026-09-16
updated: 2026-09-18
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

- **Two kinds of organization (2026-09-17):**
  - **Domain-backed** — keyed by a Google-verified Workspace domain (`hd`). Creating or claiming one requires verified control of that domain; typing a name never claims it.
  - **Domainless** — a personal Google account (e.g. Gmail) may create one. It has no `verified_domain`, so it can never collide with or become a domain's tenant.
  - A personal account **may belong to** a domain-backed org, but only once the owner verifies them — membership is granted, never self-asserted.
- **Domainless org constraints (2026-09-17):** no `verified_domain`; **exactly one owner**; a person **cannot hold more than one active** domainless org.
- **Adding a domain to a domainless org (2026-09-17):** binding a verified domain changes the org's **identity/authority metadata only — not its membership**. Existing members are **not** reclassified by the new domain: their membership already exists; the domain just gives the org a stronger identity. (Any later auth-type/Drive-path change follows from each member's own authorization, per "no authority inferred".)
- **Workspace authority is proven by Google, never self-declared (2026-09-17, user direction):** the strong signal is *walking the account in via Google* — an admin-only Google call that only a Super Admin of that domain can make succeeding **is** the evidence of control over that Workspace, and so of the org's claim to the domain. The "Are you a Super Admin?" answer only routes the flow; it never grants anything. Two distinct proofs, not to be conflated:
  1. **Admin proof** — Admin SDK Directory `users.get(userKey="me")` → `isAdmin`, under that person's own Google authorization. Proves *this account is a Super Admin of domain X*. Candidate gate for **binding the domain** to the org.
  2. **Delegation proof** — an impersonated call actually succeeding after the Admin console step. Proves *Knowhow itself is authorized Workspace-wide*. Gate for the Workspace-wide column.
- **Every org starts unbound (2026-09-17):** signup never creates a domain-backed org. The org is created with no `verified_domain`, and **binds a domain only when an admin arrives and passes admin proof**. An employee's `hd` at signup is an *observed* domain — a routing/deduplication signal, never authority.
- **Observation creates the candidate; verification upgrades it (2026-09-17):** an observed domain (`hd` at signup) creates the *organizational candidate*. **At most one active Knowhow organization may exist per observed domain, verified or not.** Verification changes that org's **authority state in place** — it never creates a second org and never splits or reassigns its existing members. Full rationale: [[0006-observed-domain-tenant-identity]].
- **Domain control must be explicitly verified (2026-09-17):** an email that merely *looks* like a domain (`john@johnconsulting.com`) proves nothing. Verification must be explicit — the DNS-record model Google itself uses for domain ownership. Membership in a Workspace (the `hd` claim) proves the account belongs to that domain, **not** that the holder controls it.
- **What an email domain can and cannot do (2026-09-17):** the account's domain affects *affiliation and joining* only — never authority.

| Action | Company email | Personal Gmail |
| --- | --- | --- |
| Create an identity | ✅ | ✅ |
| Claim/request membership | ✅ | ✅ |
| Be a member | ✅ | ✅ |
| Automatically establish org affiliation | Maybe | ❌ |
| Join an existing org without approval | Potentially | ❌ |
| Become Super Admin | ❌ | ❌ |
| Transfer ownership/control | ❌ | ❌ |
| Approve another member | Only if already authorized | Only if already authorized |

  - **Super Admin is Google's role, not Knowhow's** — Knowhow can never confer it on any account; it is only ever *proven* (admin proof above).
  - **Matching company email auto-affiliates even with an *unverified* candidate org (2026-09-17, user: "less friction")** — the "Maybe"/"Potentially" cells resolve to ✅, not gated on domain verification. Safe because Google vouches for *each* account's `hd` independently: two accounts with the same `hd` are both proven members of that Workspace, so putting them in one org asserts nothing unproven. What auto-affiliation does **not** settle is **standing** — what the joining member may see or do (below).
  - **Personal Gmail never self-joins** a domain-backed or candidate org; entry is always by approval from someone already authorized. A matching company email *may* auto-affiliate — the "Maybe"/"Potentially" cells are deliberately not yet settled (see Open questions).
- **Individual Google data access (2026-09-16):** requires authorization from *that* Google account **and** must satisfy the Workspace's app-access controls. Organization confirmation establishes organizational authority only — it never authorizes access to any user's Google data. Before ownership is confirmed, an individual may still authorize access to their own data if Google and the Workspace's app-access policies permit it. So the table's Individual Drive column means *may be authorized by that person*, not *granted by the state*; "Potentially" = subject to their consent + their Workspace's app-access policy.

## Three independent layers (2026-09-17, user's correction)

Do not conflate these — each is established differently and none implies another:
1. **Membership** — *is John part of Acme?* (`John → Acme member`)
2. **Google identity & access** — *which Google accounts does John control, and what has each authorized?* (`john@gmail.com`, `john@acme.com`). Linking proves **same person**, and **does not merge their Google data**.
3. **Authority** — *what may John do for Acme?* (member · may sponsor · may approve members · may **not** confirm company IP)

**Knowhow cannot change Google ownership by asserting it (invariant).** A Knowhow role/session says nothing about Drive. The only backend mechanism is `app/google/ownership.py::transfer_ownership` → Drive `permissions.create(transferOwnership=True)`, which Google restricts to **within one Workspace domain** and refuses between a consumer account and a Workspace. So "the company owns what the contractor creates" is achievable only by:
- **creating it as the org through Knohow** — **chosen for contractors, 2026-09-18** ([[0009-contractor-work-created-as-the-org]]): Knohow creates the file as the org's automation account and shares edit access to the contractor, so it is company-owned from creation; works for an outside/personal account;
- **a Shared Drive** — org-owned at creation, no transfer needed, also works for an outside account (**backend has no Shared Drive support at all**: no `driveId`, no `supportsAllDrives`) — [[0007-shared-drive-support]]; or
- **giving them a Workspace account** (then normal in-domain transfer applies).
~~Asking them to transfer each file~~ — corrected 2026-09-18: Google doesn't allow ownership transfer from a personal account to a Workspace account, so for an outside account this isn't an option at all; between accounts in the same Workspace it's just the option above. Copying (a member makes a company-owned copy) is the only fallback, and it loses history, comments and links.
Any other framing is Knowhow claiming ownership it does not have. Constrains Auto-Own as well as onboarding.

**Auto-affiliated ≠ member (definition corrected 2026-09-17):** *Knowhow has automatically associated this person with an organization based on evidence; nobody with organizational authority has approved it.* A matching `hd` (`john@acme.com`) auto-affiliates; a personal account (`john@gmail.com`) **never** does, even if the person genuinely works there — approval is the only door in. The earlier "matching company email auto-affiliates even into an unverified candidate" decision is about *affiliation*, not approved membership.

## Sponsorship and member standing (2026-09-17)

- **Sponsorship is vouched-only and non-transitive.** Only a member with a **Google-vouched** account (valid `hd`) may sponsor someone into the org; **sponsorship never confers the power to sponsor**. Otherwise one sponsored outsider invites the next and the org fills with people no employee ever vouched for.
- **A sponsored member appears in the org chart immediately, marked as sponsored** (user, 2026-09-17) — not held back until the owner places them.
- **Auto-affiliated** (evidence only, nobody approved): sees the org exists/its name/their association; classifies and proposes **their own** files; authorizes their own Google account; sees nothing about other members and accepts nothing.
- **Approved/sponsored adds:** appears in the member list and org chart (as sponsored); can be assigned a role/place; can be shared with and searched for; can be offboarded (only someone the org acknowledges can be).
- **Reserved to the confirmed owner:** assigning roles/org-chart placement, confirming files as company property, offboarding, and approving another *sponsor*.

Affiliation is Knowhow's guess; sponsorship is the org's statement. Neither touches [[FEAT-drive-file-classification]] authority — *who belongs* and *what is official* stay separate.

## Acting as the organization — contractors (2026-09-17, user direction; **adopted 2026-09-18** — [[0009-contractor-work-created-as-the-org]])

Ownership and **execution identity** are independent: who a file belongs to vs whose credentials an action runs under. The contractor problem is the second.

- **Contractors act *as the org*, never as a person's credentials.** The contractor signs into Knowhow; Knowhow performs the work through the service account it already holds (domain-wide delegation, `backend/app/auth/`). No password, no session sharing, nothing stranded when they leave. Password/session sharing stays forbidden — it destroys 2FA and the audit trail, which is the problem being solved.
- **Act as a dedicated automation account, not the owner (user's call):** `automations@acme.com` — a Workspace account nobody logs into. Costs a seat; keeps the owner's history clean; never leaves the company; removes the human dependency behind triggers, deployments and scheduled work generally (Apps Script is just one instance of it).
- **Scoped and time-limited.** A contractor gets neither the full feature set nor the full org: no Auto-Share, no offboarding, no global org chart. Candidate scope: their own team, the work they were brought in for. See **local vs global org chart** in [[FEAT-org-chart-builder]].
- **Attribution lives in Knowhow.** Google's logs name the impersonated/automation account; only Knowhow's audit log knows which human asked. That makes the audit log load-bearing, not decorative.
- **Delegation only covers Workspace accounts** — a contractor's personal account can never be impersonated, which is consistent: they act as the org, not as themselves.

**Entry path (2026-09-17, user):** contractors are **not** chosen in the sign-in modal (no employee/contractor toggle before auth — consistent with "nothing asked before auth"). **Decided 2026-09-18: email invite link sent by a sponsor.** Screens not designed yet.

**Contractor actions decided (2026-09-18):** create, edit, share, delete — deletes never permanent, recoverable for 30 days then gone — true of every Knohow delete ([[0009-contractor-work-created-as-the-org]], [[0010-deletes-go-to-trash-30-days]]). **Also decided 2026-09-18:** owner approves a **scope**; contractors get a **blank workspace** to work out of; entry is an **email invite link from a sponsor** (sponsorship rules below apply). See [[0009-contractor-work-created-as-the-org]]. Scope defined by **the owner or an employee**; the contractor **starts right away** in the blank workspace. A scope can be files, a folder, a team or a project; only a **team** scope needs the owner's approval. The paragraph below is superseded by these answers.

**Deliberately deferred (user, 2026-09-17: "I don't know right now... that's something we'll need to learn in the future"):** exactly which actions a contractor may have performed as the org (create/edit only, or also share, delete, change permissions — the limit is Knowhow's, not Google's); whether the owner approves per action, per scope, or per time window; what the contractor may *read* while acting as the org.

## Claims, acceptance and identity (2026-09-17)

**Anyone may claim; only standing accepts; a claim does nothing until accepted.** The [[FEAT-drive-file-classification]] chain (employee proposes → company confirms) generalized to all of onboarding.

| Claim | Who may claim | Who accepts |
| --- | --- | --- |
| Org name ("this is Acme") | anyone | nobody — a label, never authority |
| "John is the owner" | founder / any member | John, by signing in as that account |
| "This domain is ours" | anyone | **Google**, via admin proof |
| "I belong here" (personal account) | the person | someone with standing |
| "These files are company property" | the employee | owner / leader ([[FEAT-drive-file-classification]] constraint 4) |

**Standing ladder** — an acceptor must stand strictly higher than the claim:
1. **Unvouched** — personal Google account; nobody vouches for them.
2. **Google-vouched member** — a valid `hd`; Google confirms Workspace membership.
3. **Confirmed owner** — proved by signing in as the invited account.
4. **Proven Super Admin** — proved by an admin-only Google call.

**A founder is not a role — just the first claimant.** They may nominate an owner, name the org, invite people and propose a domain; none of it takes effect until something with more standing accepts. Owner confirmation doesn't strip their specialness, it makes it unnecessary.

**Identity linking (2026-09-17, user):** a person may **add further Google emails to one identity** — notably a Gmail founder adding their Workspace email. Consequences:
- **Standing is per person, raised by their highest-vouched linked email.** A founder who links a Google-vouched work email reaches level 2 and can then accept company docs (subject to the acceptor threshold for that claim type).
- **Linking must itself be proven** by signing in with that account. A typed address links nothing — same reason a lookalike domain proves nothing.
- **Data access stays per account.** Linking grants no access to either account's Google data; each still authorizes separately (see Individual Google data access above). Personal-account data stays out of org scope.
- **It supplies an observed domain**, which is the clean path out of the domainless/candidate collision below: the founder links their acme.com account rather than a second org being created.

## Approving auto-joined members (decided 2026-09-18, user)
- **Owner is self-declared; Super Admin is Google-proven.** A first joiner may answer "Yes, I'm the owner" without being a Super Admin (user confirmed this is allowed) — nothing verifies the owner claim.
- **Approvers:** the **owner** or a **Google-proven Super Admin** of the domain approves auto-affiliated coworkers. Until then everyone is limited — the first joiner included unless they are the owner.
- **A proven Super Admin can reassign the owner.** Google-proven authority outranks a self-declared claim; this is the answer to domain squatting (e.g. an intern who signed up first and claimed owner).
- Super Admin approval/override needs **admin proof** (Admin SDK `users.get("me")` → `isAdmin`), which isn't built — owner approval ships first.

## Personal account at sign-in (decided 2026-09-18, user)
When the domain check finds **no `hd`** (personal Google account):
- **Arrived through a sponsor's invite link** → joins that org as sponsored and lands in their blank workspace ([[0009-contractor-work-created-as-the-org]]).
- **Arrived cold (no invite)** → **ask first**: "This is a personal Google account. Does your company use Google Workspace?" — **Yes** → sign in with the work account instead (back to Google); **No / just me** → create a **domainless** org (one owner, one per person). Chosen to avoid the domainless ↔ candidate collision below (a Gmail founder creating a second org for a company whose employees are already on Knohow). Copy above is wording direction, not final — user designs the screen.
- **Backend today does none of this:** `bootstrap_organization` names the org after the email domain, so every Gmail user gets their own org called `gmail.com`.

## Out of scope
- Multi-domain organizations (`acme.com` + `acme.ca`) — `Organization.verified_domain` is a single unique column.
- File classification of the setup person's Drive — see [[FEAT-drive-file-classification]].

## UI/UX
Not designed. **The sign-in and onboarding screens live inside the Log In slide-up panel** ([[FEAT-landing-login-panel]]) — decided 2026-09-17; not a separate route. Copy above is the agreed wording direction, not final copy — user designs screens.

## Technical approach
**Domain check built 2026-09-18** (backend only; no screens). `complete_signup` (`backend/app/onboarding/service.py`) now:
- reads Google's **`hd`** claim (never the email string); existing email → plain login;
- **`hd` present** → `join_or_create_domain_org`: joins the org whose `observed_domain` (or `verified_domain`) matches, else creates an **unbound** org with `observed_domain = hd` (unique column, migration `0003_domain_check`). Every such member is **`auto_affiliated`** (new `OrgMember.standing`), first joiner included; org + member saved in **one transaction**;
- **no `hd`** → creates nothing; sets a 15-min signed `knohow_pending_signup` cookie and redirects to `FRONTEND_ORIGIN?signup=personal`. `POST /onboarding/personal-org` ("No / just me") creates the **domainless** org — creator approved, `personal_oauth`, and owner via an org chart; a repeat is a login. "Yes" → `GET /onboarding/signup?switch_account=true` (forces Google's account chooser).
- **Standing enforced:** `get_approved_member` guards every route exposing others' data (org chart, teams, files, search, reassignments, transfer batches, suggested shares, delegation, audit, offboard). An auto-affiliated member keeps `/auth/me` (now returns `standing`) and personal-OAuth.
- **Owner:** claiming owner in `POST /organizations/{id}/org-chart` (founding member only — others get 403) or confirming via the owner link grants `approved`. `POST /organizations/{id}/members/{member_id}/approve` — **owner only**; Super Admin approval/override waits on admin proof.
- Tests: `backend/tests/test_domain_check.py` against a real Postgres test DB (`knohow_test`).
- **Not built:** identity linking (next pass), invite-link path, org rename, admin proof, any frontend for `?signup=personal` / standing.

Gaps as of 2026-09-16 (struck where fixed 2026-09-18):
The backend already asks the two authority questions separately (`create_org_chart(is_owner, is_super_admin, owner_email)`, owner confirmation tokens) — see `backend/app/onboarding/service.py`. Gaps against this spec (as of 2026-09-16):
- ~~**No `observed_domain` column**~~ (added 2026-09-18) — nothing records the candidate domain, and `Organization.verified_domain` is a plain unique column with no notion of "active", so the one-org-per-observed-domain rule is unenforceable today.
- **`verified_domain` is set from an attestation, not a proof** — `approve_delegation()` takes the admin's word that they completed the Admin console step and copies `grant.verified_domain` onto the org (its own docstring says "records the client's attestation, not a proof"). Under the decision above, the domain must be bound only after a real Google call succeeds.
- ~~**No notion of a domainless org**~~ (added 2026-09-18) — `bootstrap_organization` treats every signup the same; `_infer_auth_type`'s free-mail heuristic would mark a domainless org's own founder `personal_oauth` (correct by accident, wrong by construction).
- **Blocked consent not handled** — no handling in `app/auth` for Google refusing authorization (e.g. the Workspace's app-access controls block Knowhow, or the user declines); the flow needs a distinct state for each.
- ~~**No `hd` check anywhere**~~ (signup uses `hd` 2026-09-18; `add_member` for invited people still uses the email heuristic) — `_infer_auth_type` guesses Workspace vs personal from the email string + a free-mail list.
- ~~**No domain check at signup**~~ (built 2026-09-18) — `complete_signup` bootstraps a new org for any unknown email; never looks up an existing org by domain.
- **`verified_domain` not set at signup** (null until delegation), and delegation derives it from the email string, not Google's `hd` (hosted-domain) ID-token claim. Only `hd` proves a Workspace account; `gmail.com` must never become a tenant.
- **Owner confirmation is possession-only** — `confirm_owner(token)` doesn't require the confirmer to be authenticated as `owner_email`.
- **Owner email unrestricted** — any address accepted.
- **Confirmation email never sent** — delivery marked out of scope in the service.
- **Identity linking not implemented (noted 2026-09-18, user)** — multiple Google emails as one person is designed ("Identity linking" above) but not built: `complete_login` / `complete_signup` look up a single `OrgMember` by exact email, so a second email is treated as a different person, and a new one bootstraps a separate org. **User, 2026-09-18: build it together with the domain checks** (`hd` check + observed-domain lookup) — a linked Workspace email is what supplies the observed domain.

## Open questions
- ~~**Domain squatting / recovery**~~ — decided 2026-09-18: a proven Super Admin can reassign the owner (see "Approving auto-joined members").
- **Two trust axes, not one:** capabilities before *owner confirmation* vs before *Super Admin authorization*. Candidate: before owner confirms — no assigning top roles, no offboarding/removing members. Before Super Admin — no Directory-sourced org chart, no reading others' Drive data, no ownership changes / Auto-Own / domain-wide operations. Manual org chart + invites allowed early.
- **Owner declines** ("that's not me") path, and letting the setup person re-nominate.
- ~~Owner outside the domain / non-Workspace users~~ — resolved: personal Gmail allowed (2026-09-16); may create a **domainless** org (2026-09-17, see Decisions).
- **Is a DNS path needed at all?** If Workspace admin proof is the mechanism, a domain with no Workspace behind it has no Workspace to control — possibly no DNS flow is ever required. Decide before building the domain-binding screen.
- ~~Does signup ever create a domain-backed org directly?~~ — no; every org starts unbound (2026-09-17, see Decisions).
- ~~Does the step-2 duplicate check use the *observed* domain?~~ — yes, one active org per observed domain (2026-09-17, [[0006-observed-domain-tenant-identity]]).
- ~~The "Maybe" / "Potentially" cells~~ — resolved 2026-09-17: auto-affiliate regardless of verification.
- **Shared Drives** — [[0007-shared-drive-support]] (open question, `draft`): unsupported today, and the contractor/outside-account case has no answer without it.
- ~~What does an Approved Member gain over an Auto-affiliated Member~~ — settled 2026-09-17, see "Sponsorship and member standing".
- **Context (superseded by the section above): member acceptance is a product decision, not an architectural consequence.** Two separate questions, not one: *who may establish that someone belongs to Acme?* vs *who may establish that something is official Acme knowledge?* The second is already answered (owner/leader; member acceptance grants no file-confirmation authority) — so a broader set may be allowed to **sponsor** members without ever deciding what becomes organizational IP. **Next question to settle: what exactly does an Approved Member gain over an Auto-affiliated Member, and what may a Google-vouched member sponsor without owner approval?**
- **Domainless ↔ candidate collision (no merge path):** a domainless org reserves no domain, so if an Acme employee has already created the acme.com candidate, the Gmail founder's org and that candidate are two orgs describing one company — and nothing merges or links them. Identity linking avoids *creating* the split; it doesn't repair an existing one.
- **Per-user-consent mode:** when no Super Admin is available or the Workspace blocks third-party apps, the org runs on individually authorized accounts only. Treat as a **supported mode**, not a failure state — the owner sees company files of everyone who consented. Needs its own UI state; nothing in the backend distinguishes it.
- **Marking Workspace-external members:** an approved personal-account member is an ordinary member today; nothing records "in the org but not in the Workspace" (delegation can never cover them).
- **Member standing / capabilities — being specified next (2026-09-17).** Auto-affiliation makes this the load-bearing question: joining is now easy, so what a member may see and do must carry the weight.
- **What makes an org "active"** for the uniqueness rule — and how is a dead/abandoned candidate released?
- **Who may verify a domain** for an org, and what happens if two orgs race for the same one.
- ~~"Individual Drive" row~~ — resolved 2026-09-16 (see Decisions).
- **"Limited" org access before owner** — the candidate list below is not yet confirmed.
- Notify Workspace admins when an org is created for their domain?

## Related
[[0004-fastapi-backend-for-auth-and-identity]] · [[FEAT-drive-file-classification]] · [[FEAT-landing-login-panel]]
