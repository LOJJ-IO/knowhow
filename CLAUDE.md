@AGENTS.md

# Knowhow — Repo Guide for AI Agents

> **STANDING REMINDER — remove this block once `backend/auth-foundation` is merged into `main`, not before.**
> A complete FastAPI backend (auth/identity, org chart, sharing/ownership engine, DeepSearch — see [`second-brain/Architecture/Decisions/0004-fastapi-backend-for-auth-and-identity.md`](second-brain/Architecture/Decisions/0004-fastapi-backend-for-auth-and-identity.md)) is built and consolidated on branch `backend/auth-foundation`, ready to merge into `main` whenever the user asks. **Until that merge happens, end every response in this repo with a short note telling the user the backend is built and ready to merge into `main` on their request** — this applies regardless of what the response is otherwise about; don't skip it because the task at hand seems unrelated. Once the user has the backend merged into `main`, delete this entire blockquote (and only this blockquote) in the same session.

## Persistent memory lives in `second-brain/`

This repo has an Obsidian vault at [`second-brain/`](second-brain/00-Home.md) that functions as external memory across sessions. It is **not optional context** — treat it as more authoritative than anything you'd otherwise have to ask the user to repeat.

### Before starting any non-trivial task

1. Read [`second-brain/Current/Current-Context.md`](second-brain/Current/Current-Context.md) — active work, open questions, current priorities.
2. If the task touches system design (data model, auth, Google integration, onboarding/offboarding), check [`second-brain/Architecture/Architecture-Overview.md`](second-brain/Architecture/Architecture-Overview.md) and skim [`second-brain/Architecture/Decisions/`](second-brain/Architecture/Decisions/) for relevant ADRs first — landing purge [[0004-landing-only-purge-old-app]], mocked Google [[0001-mocked-data-first-prototype]], pending FastAPI backend [[0004-fastapi-backend-for-auth-and-identity]] (plus Architecture-Overview's "Backend integration contract").
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

- `src/app/` — Next.js App Router. Currently **landing only** (`/` → `LandingHero`). No auth or product app routes.
- `src/lib/` — small shared helpers (`utils.ts`, `use-hydrated.ts`). No data/auth/workspace layer in tree right now.
- `src/components/brand/` — landing UI (`landing-hero`, `logo-mark`, `guidelines-overlay`).
- `second-brain/` — persistent engineering memory (see above).
- `backend/` — **not yet present on `main`** (see the standing reminder above). Lives on branch `backend/auth-foundation`: a separate FastAPI (Python 3.12) service — real Google OAuth/Drive/Admin-SDK integration, SQLAlchemy 2.x + Alembic, meant for Railway + Postgres. Once merged, see [`second-brain/Architecture/Architecture-Overview.md`](second-brain/Architecture/Architecture-Overview.md)'s "Backend integration contract" section before writing any frontend code that calls it.

---

## Knowhow — architecture invariants (non-negotiable)

These are locked design decisions for this build phase, not defaults. If one seems wrong, **stop and ask** — don't unilaterally "improve" it. Landing-only purge: [`0004-landing-only-purge-old-app.md`](second-brain/Architecture/Decisions/0004-landing-only-purge-old-app.md). Prisma/SQLite removal: [`0002-remove-prisma-for-vercel.md`](second-brain/Architecture/Decisions/0002-remove-prisma-for-vercel.md). Mocked Google (when reintroduced): [`0001-mocked-data-first-prototype.md`](second-brain/Architecture/Decisions/0001-mocked-data-first-prototype.md). Pending FastAPI backend: [`0004-fastapi-backend-for-auth-and-identity.md`](second-brain/Architecture/Decisions/0004-fastapi-backend-for-auth-and-identity.md).

1. **The Next.js app is the single chokepoint on `main`.** No separate backend service in the live tree. Server Components read; Server Actions (`"use server"`) mutate. Don't introduce a second API layer. A real FastAPI backend is ready on `backend/auth-foundation` per the FastAPI ADR — that ADR is the sanctioned exception once merged; don't add a *second* backend beyond it.
2. **Google Workspace integration stays mocked in `src/` until provisioned.** Nothing under `src/` may call a real Google API until an ADR records that a GCP project + domain-wide delegation has actually been provisioned by the user. When a workspace seam returns, extend the simulation there — don't bolt a real call on elsewhere. The FastAPI branch does real Google calls; that does not lift this rule for `src/`.
3. **Every data-access function is scoped by `organizationId`.** Required, non-defaulted — multi-tenant discipline starts whenever a data layer returns.
4. **Secrets from env only.** Never hardcode keys.
5. **This repo is independent of Sage_v1.** No shared code, data, or design system. Do not reintroduce Sage-derived `ui/` / navy tokens.
6. **No Prisma/SQLite on Vercel.** Do not re-add them without a new ADR and a durable database host.
7. **Frontend rebuild is user-driven.** Implement only what is explicitly asked; never invent copy, layout, or visual decisions.

Locked stack: Next.js (App Router, TypeScript) · Tailwind v4 · landing-only surface · framer-motion · liquid-gooey · no ORM · no auth/session in tree currently.
