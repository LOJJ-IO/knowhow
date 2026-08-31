---
type: product
status: active
tags: [area/product]
created: 2026-08-31
updated: 2026-08-31
related: ["[[FEAT-doc-visibility-dashboard]]", "[[FEAT-onboarding-offboarding-automation]]", "[[FEAT-org-chart-builder]]"]
---

# Product Vision

## Problem

In an organization using Google Workspace, documents created by team members are **not automatically visible** to the org owner, general secretary, or team leader — visibility depends on someone remembering to hit Share. This gets worse with turnover: when someone joins, granting them the right access is manual; when someone leaves, revoking access and reassigning their documents is manual, easy to forget, and a real security/continuity risk.

## Solution

Knowhow gives every organization a structured org chart (owner → teams → leaders → members) and:
1. **Makes document visibility a policy, not a habit** — a dashboard shows every team's recent docs/sheets/slides with a status indicator (shared with the owner or not), and a per-team sharing policy controls whether new documents auto-share with the leader/owner.
2. **Automates onboarding** — adding a person to a team grants their app access and enrolls their future documents in the team's sharing policy, logged to an activity feed.
3. **Automates offboarding** — removing a person transfers their owned documents to a successor (their team leader, or the org owner), revokes their access, and logs every step.

## Who it's for

- **Organization owners** — need visibility into what their teams are producing without chasing people down.
- **Team leaders** — the people day-to-day sharing habits are supposed to route through.
- **Members** — the people actually creating documents, who get a personal workspace (quick-create tiles, all-apps launcher, "Shared With You") in exchange for the org gaining visibility.

## What Knowhow is (this build pass)

Three areas, role-branched from one dashboard route:
- **Owner/leader view** — per-team recent-documents board (Docs/Sheets/Slides columns, status dot, Team Leader + Timeframe filters).
- **Personal view** — "Welcome back" workspace (Create New Work, All Apps, Shared With You).
- **Org chart + people management** — build teams, assign leaders, onboard/offboard members.

Google Workspace integration is **mocked** this pass (see [[0001-mocked-data-first-prototype]]) — the automation is real (real DB mutations, real audit trail), the Google API calls are not, yet.

## Non-goals (this pass)

- Not a real Google Admin SDK / Drive API integration yet.
- Not multi-organization billing/plans.
- Not a mobile app.

## Success looks like

- An owner can build an org chart, see which of their teams' documents are/aren't visible to them, and understand at a glance where the sharing gap is.
- Adding or removing a person produces a visible, believable trail of automated actions — not a silent no-op.
