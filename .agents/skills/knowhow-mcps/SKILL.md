---
name: knowhow-mcps
description: >-
  When to use Knowhow's Antigravity MCP servers (GitHub, Context7) and the
  built-in browser. Activate for PRs, external docs lookup, or landing visual QA.
---

# Knowhow MCP runbook

Config: `.agents/mcp_config.json` · Policy rule: `.agents/rules/mcp-policy.md`

## GitHub (`github`)

- Repo: `LOJJ-IO/knowhow`
- Use for: open/list PRs, read checks, issue context
- If tools missing: Customizations → MCP → Authenticate **github**, or install from MCP Store and re-save config
- Still honor git safety: no force-push to main; commit only when user asks

## Context7 (`context7`)

- Use before writing against unfamiliar Next.js / FastAPI / SQLAlchemy APIs
- Especially when `AGENTS.md` warns this Next version differs from training data — fetch current docs instead of guessing

## Browser (Antigravity built-in)

- After landing UI edits: open local `npm run dev`, check desktop + mobile breakpoints
- Never invent visual changes from browser findings — report and ask

## Never

Prisma MCP · Google Drive MCP for `src/` · database MCPs before Postgres is provisioned
