# Knowhow — agent entry (all tools)

**Second-brain is mandatory:** always find, read, and write `second-brain/` (entry: `second-brain/Current/Current-Context.md`). Authoritative over chat memory. Write back the same turn after durable work.

Before non-trivial work: read Current-Context and follow `CLAUDE.md` / `GEMINI.md` invariants.

**Google Antigravity:** customizations in workspace `.agents/` + root `GEMINI.md` / `AGENTS.md`. PreInvocation hook injects Current-Context every turn (`.agents/hooks.json`). (`~/.gemini/antigravity/builtin/skills/*` is built-in product documentation, not Knowhow config.) MCP: `.agents/mcp_config.json`.

**Cursor:** `.cursor/rules/` + `.cursor/skills/` (including always-on second-brain write-back).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
