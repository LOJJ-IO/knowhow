---
trigger: always_on
description: Which Antigravity MCPs Knowhow may use — and which must never be enabled.
---

# MCP policy (Knowhow)

Workspace MCP config: `.agents/mcp_config.json` (also editable via Antigravity **… → MCP Servers** / MCP Store). Global file `~/.gemini/config/mcp_config.json` is machine-wide — prefer **workspace** servers for this repo.

## Use when relevant

| Server | When |
|---|---|
| **github** | PRs, issues, checks for `LOJJ-IO/knowhow`. Authenticate in Customizations if prompted (OAuth). Prefer MCP/`gh` over inventing API curls. |
| **context7** | Up-to-date library docs — especially Next.js (this repo’s Next ≠ training data; see `AGENTS.md`) and FastAPI/SQLAlchemy. |
| **Browser** (built-in Antigravity) | Visual QA of the landing page after UI changes — not a substitute for user-driven design decisions. |

## Do not enable / do not use

- **Prisma** MCP (or any SQLite-on-Vercel path) — forbidden by invariants; no Prisma in the Next.js app.
- **Any Google Workspace / Drive MCP against `src/`** — real Google calls belong in `backend/` only after provisioning; `src/` stays mocked.
- **Neon / Cloud SQL / AlloyDB / Supabase** until the user has provisioned Postgres and asks you to wire it — don’t invent a live DB connection.
- Don’t put API tokens or OAuth client secrets in committed `mcp_config.json`. Use Antigravity Authenticate / env vars outside git.

## Hygiene

- MCP tools default to Ask mode — don’t spam approvals; batch work.
- After connecting a new server, say which tools appeared; if auth fails, tell the user to open **Customizations → MCP** and Authenticate.
- Prefer reading `second-brain/` over asking an MCP for product decisions.
