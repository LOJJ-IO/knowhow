---
type: decision
status: active
tags: [area/frontend, area/backend]
created: 2026-09-21
updated: 2026-09-21
related: ["[[FEAT-core-app-screens]]", "[[FEAT-workspace-onboarding-flow]]", "[[0016-app-reads-the-backend-not-fixtures]]", "[[0015-seeded-generative-identity-system]]", "[[0014-org-setup-and-join-link]]"]
---

# ADR-0018: The dashboard is the first screen, and every onboarding answer is on it

## Status
`active`

## Context
The user's report (2026-09-21): "the things we did in the onboarding like make team, add another
account etc aren't reflecting on the dashboard", followed by "think about all the functions on the
onboarding, they should all seed this dashboard."

Onboarding asks a long series of questions and **each answer lands in a different table** — the
organization, the org chart, teams, memberships, join links, invitations, members and their standing,
people and their linked addresses. Nothing in the app read any of it except the teams list.

## Decision
1. **A `Dashboard` screen at `/dashboard` is the app's home** (`APP_HOME`), and it is the first nav row.
   `/workspace` keeps its meaning from [[FEAT-core-app-screens]] — documents — which is why the
   dashboard is its own screen rather than being crammed in there.
2. **One backend read seeds it:** `GET /organizations/{org_id}/overview`
   (`onboarding.service.org_overview`). One round trip on purpose — the dashboard is the first thing
   rendered after sign-in, and five parallel requests to build it are five ways to half-render.
3. **Every onboarding answer is represented:**

   | Onboarding asked | Lands in | On the dashboard as |
   | --- | --- | --- |
   | What is the organization called? | `organizations.name` | The heading |
   | Which domain did you sign in from? | `observed_domain` | "Signed in from …" |
   | Did setup finish? | `setup_step`, `setup_completed_at` | "setup complete" |
   | Are you the owner / who is? | `org_charts.owner_member_id` | Owner chip, and the top of the org chart |
   | Nominated an owner who hasn't signed in | `nominated_super_admin_email` | A line under People |
   | Are you a Super Admin? (+ Google's answer) | `super_admin_verified_at` | "Google confirmed a Super Admin" |
   | How many teams, and their names | `teams` | Team cards, each with its generated icon |
   | Which teams are you in? | `org_memberships` | Member counts, "You are in …" |
   | Org-wide roles | `org_memberships` with no `team_id` | Role chips |
   | Auto-Own per team | `teams.auto_own_enabled` | "Auto-Own on" |
   | The join link | `join_links` | "Join link live" / "No join link" |
   | Open invitations | `invitations` | A stat |
   | People arriving, approved or not | `org_members.standing` | People list, "Waiting for approval" |
   | **Add another account** | `org_members.person_id` shared | Counted as *people*, not accounts |

4. **`list_members` is readable by any member of the org**, not owner-only. Who is in the organization
   is not privileged information inside a tenant. Approving people stays owner-only — that is
   `list_pending_members`, a queue of decisions rather than a summary.
5. **The org chart is a graph, not a list** — owner at the top, teams spread beneath forming its
   breadth, on a dotted canvas with draggable cards and measured connectors. Built from a flowchart
   component the user supplied; its mechanics were kept (measured node heights, derived row offsets,
   bezier anchors, drag clamped to the canvas, a real drag not allowed to also toggle selection) and
   retokenised. `src/components/app/flow-canvas.tsx` is generic: it knows rows, widths and edges, and
   nothing about organizations.

## Consequences
- Backend gained `org_overview` + `list_members` and one route, covered by `tests/test_org_overview.py`
  (3 tests: every answer present; revoked and expired join links don't read as live; linked accounts
  share a `person_id`). Full suite: 112 passing.
- The dashboard is a **read**. Nothing on it acts yet — approving a waiting member, reissuing a join
  link and editing teams are all still to come.
- Adding an onboarding question now means adding it to `org_overview` too, or the dashboard silently
  stops being complete. That coupling is deliberate: one read, one place to keep honest.
