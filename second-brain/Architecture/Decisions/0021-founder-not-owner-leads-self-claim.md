---
type: decision
status: active
tags: [area/onboarding, area/security, area/backend, area/frontend]
created: 2026-09-26
updated: 2026-09-26
related: ["[[0014-org-setup-and-join-link]]", "[[FEAT-workspace-onboarding-flow]]", "[[0006-observed-domain-tenant-identity]]", "[[0013-sign-in-is-to-an-organization]]", "[[0009-contractor-work-created-as-the-org]]"]
---

# ADR-0021: Founder ≠ owner; leads self-claim; team lead is the daily approver

## Status
`active` — locked with the user 2026-09-26 (checklist A–I all yes). **Not built.** Supersedes [[0014-org-setup-and-join-link]] on ownership, lead assignment, join approval, and who may reissue the join link. Parts of 0014 that still hold (domain-locked org-wide link, teams-only chart, resume/save-as-you-go, wrong-account switch, contractors off this link) are restated below so this ADR is the single source.

## Context
ADR-0014 made the first person from the domain **own the org outright** and named team leads only when the owner approved a joiner. The user corrected that: the first joiner is only the **founder** (runs setup). Owner is a separate claim. Team leads should self-nominate on join so owner/Super Admin are not the daily bottleneck. Super Admin (Google-proven) remains the undo button for bad claims and the key to Workspace connect.

## Decision

### Roles (authority top → down)
1. **Super Admin** — Google-proven (`isAdmin`). Highest undo power: reassign owner, demote false leads, override approvals, connect Workspace. Inbox should stay light when leads already handled joins.
2. **Owner** — top of the **org chart** (Knohow). Claim, then confirm (e.g. sign in as invited account). Not inferred from founding. Multiple real-world execs (president, VP, secretary) are **not** multiple owners — pick one chart owner; others are leads/members.
3. **Team lead(s)** — default approver for **their team** (auto-own, auto-share, join requests for that team). Later, a team may have **more than one** lead; early on one is enough.
4. **Member** — everyone else.

**Founder** = first person to sign in from the domain who runs setup. **Founder ≠ owner.** Never assume they are the real top of the org.

Jargon in UI: if **Owner** or **Super Admin** appears, underline + short tooltip + link to docs/Google help. Prefer plain language first.

### Setup (founder)
- Runs setup with **no proof gate** (same blast-radius reasoning as 0014: domain-locked link + later undo).
- Names the org → creates **teams only, no named seats** → picks own team(s) or none → creates **one org-wide join link**.
- May **invite the owner** (email) so the chart gets a confirmed top; until then owner may be unset.
- Then Workspace-connect path ([[FEAT-workspace-onboarding-flow]]): Google checks this account → Connect, or invite someone who can (know who → email; don't know → copy open link).
- Every path still lands in the **app** (limited until connect / approvals finish).

### Join link
- **One org-wide link** + team pick (domain-locked). Contractors stay on the sponsored path ([[0009-contractor-work-created-as-the-org]]).
- **Expires / revocable.** Reissuing creates a new link and revokes the old one; people already in stay in.
- Who may create/reissue: **team lead, founder, owner, Super Admin** — so execs are not disturbed for every expired link.

### Joining (flows using the org link)
- Pick one or more teams. For **each** team: “Are you the team lead?” when relevant.
- **No lead yet** → first person who **claims** lead **is** the lead (not a request). First person to join as **member** is not automatically lead.
- **Lead already exists** → joining that team is a **request** to the team lead (owner / Super Admin are last-step backup).
- Same person may be in multiple teams, lead multiple teams, and be member-only on others.
- **“I’m the owner”** on join (only if owner not yet confirmed) is a **claim**, not an instant grant. Low incentive to lie on a work-domain org; Super Admin can undo.
- After the step → **app** (empty/limited while waiting where a request applies).

### Super Admin’s job
- Prove connect / finish Workspace setup.
- Review **exceptions** (wrong owner claim, false lead, stuck requests) — not a mountain of routine team joins if leads did their job.
- Can always undo incorrect setup decisions.

### Still true from 0014
- Resume unfinished setup at the saved step; waiting-for-approval is not “unfinished setup.”
- Save teams as they go; setup completion is its own flag.
- Wrong Google account at a named invite → switch account, still a path into the app.
- Account already in another org → refuse ([[0013-sign-in-is-to-an-organization]]).
- Removal from chart revokes Knohow-granted sharing and says clearly what Google access we can’t pull.

## Alternatives considered
- **Founder owns the org outright** (0014) — rejected 2026-09-26: conflates setup runner with chart owner.
- **Leads only named at owner approval** (0014) — rejected: bottlenecks execs; first lead claim is enough early, with SA undo.
- **Every team join is always a request** — rejected: with no lead yet there is nobody useful to request to; first claim grants lead.
- **First joiner to a team is automatically lead** — rejected: you can join as member first; only an explicit claim makes you lead.
- **Per-team join links** — rejected: one org-wide link + team pick is simpler; leads reissue that same link.
- **Multiple chart owners for president/VP/secretary** — rejected: one chart owner; others are leads/members.
- **Blocking the app until Super Admin connects** — rejected: value before authority; limited access is fine.

## Consequences
- Supersedes 0014’s ownership, lead-naming, and “always request” rules — implementers must follow this ADR.
- Needs: founder vs owner distinction in product copy and data; lead claim vs member join; request state only when a lead exists; multi-lead later; join-link ACL including team leads; owner claim + confirm; SA exception inbox (not a full join queue by default).
- Live product still follows older UI (owner/Super Admin Yes/No questions, etc.) until built — see [[FEAT-workspace-onboarding-flow]].

## Related
- Supersedes [[0014-org-setup-and-join-link]]
- [[FEAT-workspace-onboarding-flow]] — screens and Workspace-connect path
- [[0006-observed-domain-tenant-identity]], [[0013-sign-in-is-to-an-organization]], [[0009-contractor-work-created-as-the-org]]
