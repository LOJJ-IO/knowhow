---
trigger: always_on
description: Non-negotiable Knowhow architecture invariants. Always apply. Second-brain mandatory.
---

# Knowhow invariants — do not violate

If a request conflicts with these, **stop and ask**. Do not unilaterally “improve” them.

**Second-brain first:** always find/read/write `second-brain/` (see Always On rule `second-brain.md` + PreInvocation hook). Entry `@../../second-brain/Current/Current-Context.md`.

Full detail: `@../../CLAUDE.md` · ADRs in `@../../second-brain/Architecture/Decisions/`

1. **Frontend chokepoint.** Next.js App Router only for UI. Server Components read; Server Actions mutate. Do not add a second frontend API layer. `backend/` is the one sanctioned separate service — do not add another.
2. **No real Google from `src/`.** Nothing under `src/` calls a real Google API until an ADR records that GCP + domain-wide delegation is provisioned. `backend/` may call Google; that does **not** lift this for `src/`.
3. **`organizationId` required** on every data-access function when a data layer exists — no defaults.
4. **Secrets from env only.** Never hardcode keys.
5. **Independent of Sage_v1.** No shared code, data, or design system. Do not reintroduce Sage `ui/` / navy tokens.
6. **No Prisma/SQLite on Vercel.** Do not re-add without a new ADR + durable DB host.
7. **User-driven frontend.** Implement **only** what is explicitly asked. Never invent copy, layout, or visual decisions. Ask rather than fill gaps.

## Locked stack

- Frontend: Next.js App Router · TypeScript · Tailwind v4 · landing-only (`/` → `LandingHero`) · framer-motion · liquid-gooey · no ORM · no auth/session in `src/` currently.
- Backend: FastAPI · Python 3.12 · SQLAlchemy 2.x + Alembic · Railway + Postgres (**not provisioned yet**).
