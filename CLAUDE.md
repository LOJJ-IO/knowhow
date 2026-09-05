@AGENTS.md

# Knowhow — Repo Guide for AI Agents

## Persistent memory lives in `second-brain/`

This repo has an Obsidian vault at [`second-brain/`](second-brain/00-Home.md) that functions as external memory across sessions. It is **not optional context** — treat it as more authoritative than anything you'd otherwise have to ask the user to repeat.

### Before starting any non-trivial task

1. Read [`second-brain/Current/Current-Context.md`](second-brain/Current/Current-Context.md) — active work, open questions, current priorities.
2. If the task touches system design (data model, auth, the onboarding/offboarding engine, Google integration), check [`second-brain/Architecture/Architecture-Overview.md`](second-brain/Architecture/Architecture-Overview.md) and skim [`second-brain/Architecture/Decisions/`](second-brain/Architecture/Decisions/) for relevant ADRs first — [`0001-mocked-data-first-prototype.md`](second-brain/Architecture/Decisions/0001-mocked-data-first-prototype.md) explains why Google Workspace calls are mocked right now and where that seam is.
3. If the task touches a known bug or pattern, check [`second-brain/Engineering/Known-Issues.md`](second-brain/Engineering/Known-Issues.md) and [`second-brain/Engineering/Lessons-Learned.md`](second-brain/Engineering/Lessons-Learned.md).
4. If the task is a feature, check whether a spec already exists in [`second-brain/Product/Features/`](second-brain/Product/Features/).

### After finishing non-trivial work, write back

- **Architecture decision made or changed?** Add a new ADR in `second-brain/Architecture/Decisions/` using [`second-brain/Templates/ADR.md`](second-brain/Templates/ADR.md). Supersede old ADRs rather than editing them.
- **Bug found or fixed?** Update [`second-brain/Engineering/Known-Issues.md`](second-brain/Engineering/Known-Issues.md) (or promote to a full bug file under `second-brain/Engineering/Bugs/` using the template, for anything user-impacting enough to warrant one).
- **Feature shipped or specced?** Add/update `second-brain/Product/Features/FEAT-*.md` using [`second-brain/Templates/Feature-Spec.md`](second-brain/Templates/Feature-Spec.md).
- **Learned something non-obvious?** Append it to [`second-brain/Engineering/Lessons-Learned.md`](second-brain/Engineering/Lessons-Learned.md).
- **Priorities or active work changed?** Update [`second-brain/Current/Current-Context.md`](second-brain/Current/Current-Context.md) directly.

### Rules
- Never duplicate a fact that already lives in the vault — link to it (`[[Note-Name]]`) instead.
- Every vault note keeps its YAML frontmatter (`type`, `status`, `tags`, `created`, `updated`, `related`) — see [`second-brain/README.md`](second-brain/README.md).
- Prefer editing/extending an existing note over creating a new one.

## Repo layout

- `src/app/` — Next.js App Router: `(auth)/` (login/signup, unauthenticated), `(app)/` (everything behind a session — dashboard, org-chart, team people management, activity, settings).
- `src/lib/` — data access (`queries.ts` — stubbed), auth (`auth.ts`, `session.ts`, `password.ts`), the onboarding/offboarding engine (`workspace.ts` — stubbed).
- `src/components/` — `ui/` (design-system primitives), `shell/` (sidebar), `dashboard/`, `team/`, `settings/`, `brand/`, `theme/`.
- `second-brain/` — persistent engineering memory (see above).

---

## Knowhow — architecture invariants (non-negotiable)

These are locked design decisions for this build phase, not defaults. If one seems wrong, **stop and ask** — don't unilaterally "improve" it. Full reasoning: [`second-brain/Architecture/Decisions/0001-mocked-data-first-prototype.md`](second-brain/Architecture/Decisions/0001-mocked-data-first-prototype.md). Prisma/SQLite removal: [`0002-remove-prisma-for-vercel.md`](second-brain/Architecture/Decisions/0002-remove-prisma-for-vercel.md).

1. **The Next.js app is the single chokepoint.** No separate backend service. Server Components read; Server Actions (`"use server"`) mutate. Don't introduce a second API layer.
2. **Google Workspace integration is mocked.** Nothing under `src/lib/` may call a real Google API until an ADR records that a GCP project + domain-wide delegation has actually been provisioned by the user. `src/lib/workspace.ts` (`onboardPerson`/`offboardPerson`) is the seam — extend the simulation there, don't bolt a real call on elsewhere.
3. **Every data-access function is scoped by `organizationId`.** It's a required, non-defaulted argument — this repo will eventually be multi-tenant, so this discipline starts now, not later. See `src/lib/queries.ts` for the pattern.
4. **Secrets from env only.** Never hardcode keys.
5. **This repo is independent of Sage_v1.** It started as a spinoff conversation from that repo and intentionally borrowed its design language (see `src/app/globals.css`, `src/components/ui/`), but the two products share no code, no data, and no architecture invariants beyond that visual similarity.
6. **No Prisma/SQLite on Vercel.** ORM and local SQLite were removed for deployability; do not re-add them without a new ADR and a durable database host.

Locked stack: Next.js (App Router, TypeScript) · Tailwind v4 · no ORM currently (data layer stubbed) · cookie-session helpers (no NextAuth) · no external state library (React state + Server Actions + `router.refresh()` is enough at this scale).