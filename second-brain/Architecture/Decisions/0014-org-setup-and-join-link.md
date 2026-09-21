---
type: decision
status: active
tags: [area/onboarding, area/security, area/backend, area/frontend]
created: 2026-09-20
updated: 2026-09-20
related: ["[[FEAT-workspace-onboarding-flow]]", "[[FEAT-landing-login-panel]]", "[[0006-observed-domain-tenant-identity]]", "[[0013-sign-in-is-to-an-organization]]", "[[0009-contractor-work-created-as-the-org]]", "[[Known-Issues]]"]
---

# ADR-0014: Org setup builds teams, and one revocable domain-locked link brings everyone else in

## Status
`active` — decided 2026-09-20 with the user. Not built.

## Context
Setup is the next onboarding step for **both** flows (Workspace account and personal account), and it is
where the org chart is created. The user's shape: the first person creates the groups in the
organisation, then sends **one deep link**; that link takes everyone else to the sign-in page, they join
the org, select a team, and enter the app.

One link doing three jobs at once (proving you belong, putting you in the org, and letting you pick your
own access) is where the security edge cases live. This ADR records the answers agreed in that pass.

## Decision

**Setup (the person who runs it)**
- **The first person to sign in from the domain runs setup and owns the org outright** — no proof gate in
  front of it. The blast radius is contained by the link being domain-locked and joins needing approval, so
  the worst case stays inside the company. If the wrong person got there first, **admin proof takes the org
  over**: a proven Workspace admin claims ownership using the admin-proof flow already built.
- **Setup names the organization first** (user, 2026-09-21). A Workspace org is created with its hosted
  domain as its name (`acme.org`) because nobody has been asked yet; that placeholder would otherwise
  surface on the invite link's sign-in screen, in the "already with {OtherOrg}" refusal and in the Log In
  account picker. The field is **prefilled with a guess from the domain** (`acme.org` → `Acme`), selected
  so one keystroke replaces it.
- The chart built at setup holds **teams only, no named seats**. People fill in as they join, so the
  owner is not entering a roster of emails up front and nobody has to "claim" a name.
- Teams are **typed in one at a time**, and **pulled from the org's Google Workspace groups when that is
  available** (delegation/Admin SDK approved). Typing always works; the import is an accelerator, never a
  requirement.
- **The founder's own team is asked after the teams exist**, on its own screen, with "none" allowed.
- **Team leads are named by the owner when approving someone into that team** — there is no lead until a
  real person is in the team, which keeps the no-roster property of the chart.
- After setup, **the owner, admins, and a team's own lead** can add or change teams (a lead only for their
  team).
- Setup ends with **one deep link** to send out.

**The link**
- **Domain-locked.** Only Google work accounts on the org's domain may use it. Personal Gmail and outside
  domains are refused and told to use their work account. This keeps [[0006-observed-domain-tenant-identity]]'s
  domain check in force instead of letting a link route around it.
- Contractors and anyone off-domain do **not** use this link — they keep the separate sponsored path in
  [[0009-contractor-work-created-as-the-org]].
- **Expires**, with the **owner choosing the lifetime when sending**, and the owner can **revoke** it early
  and issue a new one. People who already joined stay in.

**Joining**
- Selecting a team is a **request, not a grant**. Access turns on only after approval. This is the single
  most important line in this ADR: picking a team is picking what files you can see, so it can never be a
  free self-service choice.
- **Owner or an admin approves.** One pending list.
- While waiting, the person is **in the app but empty** — oriented, no team content, with a line saying
  it is with the owner.

**Resuming an unfinished onboarding (user, 2026-09-21)**
- **If an onboarding step hasn't been completed, signing in takes the person back to that step — never to
  Get Started.** Sign-in is the resume point, not a fresh start.
- This is currently **not true**: `signup_redirect` in `backend/app/api/routes/auth.py` sends a successful
  sign-in to `frontend_origin` with nothing marking the unfinished step, so the person lands on the landing
  page where Get Started is the only thing on offer.
- Implies the backend must report **where the person stopped** (an onboarding state on the member/org that
  the callback and the session both expose), and the frontend must route on it before rendering the landing.
- **Waiting for approval is not an unfinished step** — those people resume into the empty in-app state, not
  back into setup.
- Someone whose onboarding is finished must **never** see a resumed step.
- **Work is saved as they go** (user, 2026-09-21), not batched at the end of a step. A founder who types
  three teams and closes the tab comes back to those three teams, not to an empty team step. Each team is
  persisted as it is added, so the org chart can exist in a half-built state while setup is still
  incomplete — which means setup completion is its own flag, not "does the org have teams", and the join
  link stays unsendable until that flag is set. Also implies a way to **remove** a team typed by mistake.

**Edge cases at the link**
- **Wrong account already signed in:** name the account/domain the link expects and offer one button to
  switch. Same shape as the existing `?invite=wrong_account` case.
- **Account already belongs to another Knohow org:** refuse and explain. Sign-in is to one organization
  ([[0013-sign-in-is-to-an-organization]]); no multi-org switcher, no silent move.

**After the fact**
- The owner gets a screen showing **who joined, when, and who is pending** — enough to spot a stranger.
- **Removal from the chart revokes access.** Knohow pulls the sharing it granted and reports what it
  revoked. Access Google granted outside Knohow is not ours to remove, and the UI says so rather than
  implying the person is fully off.

## Alternatives considered
- **Free team choice, no gate** — rejected: anyone with the link puts themselves in Finance or Leadership
  on day one and nobody is asked.
- **Free choice with sensitive teams marked** — rejected: relies on the owner correctly marking every
  sensitive team at setup, and fails silently when they miss one.
- **Owner pre-assigns people to teams** — rejected with "no seats, just teams": it forces the owner to
  enter a full roster during setup, which is the slowest possible first run.
- **Named seats the joiner claims** — rejected: nothing proves the signed-in account is that name, so it
  adds an impersonation surface for no gain once teams are the only unit.
- **Link open to any Google account** — rejected: it quietly bypasses the domain check already built.
- **Link that never expires** — rejected: a forwarded copy stays live forever. A use-count cap was also
  rejected as a poor proxy for time.
- **Owner-only approval** — rejected as a bottleneck in a large rollout.
- **Multi-org switcher on one account** — rejected: contradicts [[0013-sign-in-is-to-an-organization]] and
  multiplies cross-org leak paths.
- **Chart removal as a label only** — rejected: leaves the offboarding hole open while looking done.
- **Gating setup itself on admin proof** — rejected: it blocks the founder whenever the Admin SDK isn't
  enabled yet. Proof became the *recovery* path instead of the entry gate.
- **Suggested starter team names** (Engineering, Sales, Finance) — rejected: that is invented copy in the
  product.
- **Leaving the org name empty, or prefilled with the raw domain** — rejected: empty is one more thing to
  do, and the raw domain is the name most people would simply accept, which is how `acme.org` ends up on
  everyone's screen.
- **Naming the org before the owner/Super Admin questions** — rejected: the authority questions come first,
  naming opens setup proper.
- **A lead field on each team at setup** — rejected: it reintroduces the roster of emails the no-seats
  decision exists to avoid.
- **First person approved into a team becomes its lead** — rejected: wrong whenever the first joiner isn't
  the lead.

## Consequences
- Needs a **pending-request** state distinct from the existing pending-join state, and an approver UI
  (owner/admin) that shows the requested team next to the requester's email.
- Needs an **empty in-app state** for approved-but-unassigned people — the first real signed-in screen.
- Needs **link records** (issuer, lifetime chosen, revoked flag, joins) rather than a stateless signed URL.
- Revocation-on-removal depends on delegation being provisioned; until then it is mocked in `src/` per
  [[0001-mocked-data-first-prototype]] and only `backend/` can do the real Drive calls.
- Needs a **team lead** role on team membership, set from the approval screen.
- Needs a stored **onboarding state per person** and a resume route, replacing the current bare redirect to
  `frontend_origin`.
- Needs an **ownership takeover** path driven by admin proof, on top of the existing proof flow.
- The Workspace-groups import must **degrade to typing** when delegation isn't approved, and must not read
  the directory before the org has agreed to delegation.
- Copy for every screen here is still the user's to write — nothing is to be invented.

## Related
- [[FEAT-workspace-onboarding-flow]] — the flow this step sits in
- [[0006-observed-domain-tenant-identity]], [[0013-sign-in-is-to-an-organization]] — invariants this leans on
- [[0009-contractor-work-created-as-the-org]] — the off-domain path this link deliberately excludes
