# Knowhow — Antigravity / Gemini rules

Always active for this repo (no frontmatter). Full detail: `CLAUDE.md`. Workspace: `.agents/rules/`, `.agents/skills/`, `.agents/mcp_config.json`, `.agents/hooks.json`.

## SECOND-BRAIN (mandatory — every turn)

Vault: `second-brain/`. Authoritative over chat memory.

1. **Always find it.** Path is repo-root `second-brain/`. Entry: `second-brain/Current/Current-Context.md`.
2. **Always read it** before non-trivial work (Current-Context first; then ADR / Known-Issues / Lessons / FEAT as relevant). A PreInvocation hook also injects Current-Context — still open the real files when editing.
3. **Always write it** after durable work in the **same turn**: update Current-Context; add/update ADR, Known-Issues, Lessons-Learned, or FEAT as needed. Skill: `update-second-brain`. Do not end until the vault matches reality (skip only pure Q&A with no durable facts).
4. Link `[[Note-Name]]`; keep YAML frontmatter; bump `updated`. Prefer edit over new notes.

## Other non-negotiables

1. Next.js is the frontend chokepoint. `backend/` is the one sanctioned separate service — do not add another.
2. Nothing under `src/` calls a real Google API until an ADR records GCP + domain-wide delegation is provisioned.
3. Data access takes required `organizationId` (no defaults) when a data layer exists.
4. Secrets from env only.
5. Independent of Sage_v1 — no Sage `ui/` / navy tokens.
6. No Prisma/SQLite on Vercel.
7. Implement **only** what the user explicitly asked — never invent copy, layout, or visual decisions.

## MCP

Use `.agents/mcp_config.json` (github + context7). No Prisma MCP, no Google Drive MCP against `src/`, no DB MCPs until Postgres is provisioned.
