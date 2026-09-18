---
trigger: glob
description: FastAPI backend constraints under backend/.
globs: "{backend/**,*.py}"
---

# Backend (`backend/`)

- Separate FastAPI service (Python 3.12 · SQLAlchemy 2.x · Alembic). Not a second frontend API for Next.js inventiveness — it is the sanctioned Google/auth service.
- Secrets from env only (`backend/.env.example`). Never commit keys.
- Before wiring Next.js → backend: read the **Backend integration contract** in `@../../second-brain/Architecture/Architecture-Overview.md` and ADR `@../../second-brain/Architecture/Decisions/0004-fastapi-backend-for-auth-and-identity.md`.
- Do not start GCP / Railway / OAuth-verification provisioning unless the user asks.
- Org tenancy: prefer verified Workspace domain as tenant identity (see ADRs `0006-*`); organization display name is metadata, not auth.
- Owner confirmation must require Google auth as the invited owner — never treat a bare URL as proof of ownership when changing that flow.
