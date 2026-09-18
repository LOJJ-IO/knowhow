# Knowhow — Antigravity / Gemini rules

Always active for this repo (no frontmatter). Full detail: `CLAUDE.md`. Workspace extras: `.agents/rules/`, `.agents/skills/`, `.agents/mcp_config.json` (see Antigravity customizations guide).

## Before non-trivial work

1. Read `second-brain/Current/Current-Context.md`
2. For system design / auth / Google: `second-brain/Architecture/` + ADRs
3. Implement **only** what the user explicitly asked — never invent copy, layout, or visual decisions

## Non-negotiable

1. Next.js is the frontend chokepoint. `backend/` is the one sanctioned separate service — do not add another.
2. Nothing under `src/` calls a real Google API until an ADR records GCP + domain-wide delegation is provisioned.
3. Data access takes required `organizationId` (no defaults) when a data layer exists.
4. Secrets from env only.
5. Independent of Sage_v1 — no Sage `ui/` / navy tokens.
6. No Prisma/SQLite on Vercel.
7. After durable work: update `second-brain/` the same turn (Current-Context / ADR / Known-Issues / Lessons / FEAT).

## MCP

Use workspace `.agents/mcp_config.json` (github + context7). Do not enable Prisma MCP, Google Drive MCP against `src/`, or DB MCPs until Postgres is provisioned. Authenticate github in Customizations if tools are missing.
