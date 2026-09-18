# Knowhow — agent entry (all tools)

Before non-trivial work: read `second-brain/Current/Current-Context.md` and follow `CLAUDE.md` invariants.

**Google Antigravity:** customizations for this repo are in workspace `.agents/` + root `GEMINI.md` / `AGENTS.md`. (`~/.gemini/antigravity/builtin/skills/*` is built-in product documentation, not where Knowhow rules are stored.) MCP: `.agents/mcp_config.json`. See `mcp-policy` rule.

**Cursor:** also `.cursor/rules/` and `.cursor/skills/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
