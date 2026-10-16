---
type: decision
status: active
tags: [area/frontend, area/backend, area/onboarding]
created: 2026-09-27
updated: 2026-09-27
related: ["[[0021-founder-not-owner-leads-self-claim]]", "[[FEAT-workspace-onboarding-flow]]"]
---

# ADR-0023: Founder setup runs the Google check before the owner question

## Status
`active`. Amends the founder-setup **order** in [[0021-founder-not-owner-leads-self-claim]]; its ownership rules stand.

## Context
Setup ended: join link → "Do you know who sits at the top?" (invite owner) → setup marked done → Connect Workspace (Google Super Admin check). The user (2026-09-27) wanted the founder asked whether *they* are the owner before being asked who is, and the Google check before that, because the owner "may not be the same as the Google Super Admin".

## Decision
Founder setup order: org name → teams → own teams → join link → **Connect Workspace** ("Check with Google" button, see below; failure → know-who / invite; success → Drive delegation step) → **"Do you sit at the top?"** (Yes / No) → on No, **"Do you know who sits at the top?"** → done.

- **Yes** is a **pending owner claim** (`POST /organizations/{org_id}/owner-claim` → `claim_pending_owner`), same as a joiner's; never an instant grant.
- `setup_step` gains `connectWorkspace` (between `inviteLink` and `inviteOwner`); `done` is recorded only after the owner question, so leaving for Google no longer counts as finishing setup.
- Back from Google, `AppEntry` sends a mid-setup founder to the owner question (`startAt="inviteOwner"`), after the delegation step on success or via "Continue" on the not-confirmed screen.
- "owner" and "Super Admin" definitions use one `SetupTerm` tooltip (app tooltip, wider). Owner: "The person at the top of your organization in Knohow. They approve org-wide decisions. They may not be the same as your Google Workspace Super Admin."

## Alternatives considered
- **"Are you the owner?"** heading: offered; user chose "Do you sit at the top?" to match the next screen.
- **Yes makes them owner outright**: rejected, keeps ADR-0021's claim rule.
- **Ask "Are you a Super Admin?" before the Google check**: rejected.
- **Keep the auto-start (`4ee5629`)**: tried first; the screen only flashed, so (same day) it waits for **Check with Google**, with the Super Admin definition in its body.

## Consequences
- The not-confirmed result panel takes an optional `onContinue`; mid-setup its button reads "Continue" instead of "Continue to the app".
