---
type: decision
status: active
tags: [area/product, area/backend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[Architecture-Overview]]", "[[FEAT-doc-visibility-dashboard]]", "[[FEAT-onboarding-offboarding-automation]]"]
---

# ADR-0001: Separate repo, mocked Google Workspace data for the first build pass

## Status
`active`

## Context
Knowhow started as a spinoff idea inside a conversation about Sage (a separate, existing RAG document Q&A product with its own locked architecture — see [Sage's ADR-0008](../../../Sage_v1/second-brain/Architecture/Decisions/0008-fastapi-owned-pgvector-rag-backend.md)). The user shared a mockup deck: an app that solves "documents created by team members aren't always shared with the org owner/team leader," built around an org chart, a doc-visibility dashboard (per-team, red/green sharing status), and automated onboarding/offboarding for Google Workspace access.

Two things forced a decision before writing code:
1. Knhow/Knowhow is architecturally unrelated to Sage — different data model, different integration surface (Google Admin SDK / Drive API vs. pgvector RAG). Building it inside Sage's repo would mean either violating Sage's locked invariants or maintaining two unrelated architectures side by side.
2. The real version of "automated onboarding/offboarding" needs Google Workspace **domain-wide delegation** — a service account, a GCP project, and a Workspace admin explicitly granting delegation in the Admin console. None of that can be provisioned by an agent; it requires the user's action outside this repo.

## Decision
- **New, separate repo** (`/Users/user/knowhow`), independent of Sage. Next.js 15 App Router (TypeScript, Tailwind v4), Prisma + SQLite for persistence, custom cookie-based mock auth (no NextAuth).
- **Mock Google Workspace data for this pass.** Nothing under `lib/` calls a real Google API. Onboarding/offboarding, doc sharing, and "All Apps" are all simulated against the local database, but the mutations are real (see [[FEAT-onboarding-offboarding-automation]]) — adding/removing a person actually changes rows and writes an audit trail, it just doesn't call Google yet.
- Design language (colors, radius, button/input styling, grayscale oklch tokens) was ported from Sage's frontend on request, so the two products feel like siblings even though the codebases don't share dependencies.

## Alternatives considered
- **Build inside Sage_v1** (`knhow/` subdirectory or inside `frontend/`/`backend/`) — rejected: Sage's CLAUDE.md invariants (FastAPI-owns-everything, Supabase-as-dumb-infra, `business_id` scoping for pgvector retrieval) don't apply here and would either be ignored or awkwardly reused for an unrelated data model.
- **Real Google Admin SDK integration from day one** — rejected for this pass: needs a GCP project + domain-wide delegation grant that only the user can set up. Revisit once that's provisioned.

## Consequences
- Every future PR that adds a real Google API call should reference this ADR and record a follow-up ADR when domain-wide delegation is actually wired in (don't just start calling the API quietly — flip the decision explicitly).
- The mocked seams are intentionally named to make the eventual swap obvious: `lib/workspace.ts` (`onboardPerson` / `offboardPerson`) is where real Admin SDK calls will replace the simulated `MOCK_APPS` grant/revoke list.
- SQLite is a prototyping choice, not a production one — migrating to Postgres (matching Sage's infra pattern, or a fresh choice) is a follow-up decision, not assumed here.

## Related
- [[FEAT-doc-visibility-dashboard]], [[FEAT-onboarding-offboarding-automation]], [[FEAT-org-chart-builder]]
- Sage's [0007-boutique-retail-mvp-beachhead](../../../Sage_v1/second-brain/Architecture/Decisions/0007-boutique-retail-mvp-beachhead.md) and [0008](../../../Sage_v1/second-brain/Architecture/Decisions/0008-fastapi-owned-pgvector-rag-backend.md) — for context on why this became its own repo rather than a Sage feature.
