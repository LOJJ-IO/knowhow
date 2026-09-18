---
trigger: glob
description: Landing-only Next.js frontend constraints for src/ files.
globs: "{src/**,*.tsx,*.ts,*.css}"
---

# Frontend (`src/`) — landing only

- Live surface is **landing only**: `/` → `LandingHero`. Do not invent auth/product routes unless the user explicitly asks.
- Implement only the asked change. No invented copy, layout, colors, or motion.
- Do not call real Google APIs from `src/`.
- Do not reintroduce Sage-derived `ui/` components or navy/oklch design tokens.
- Do not add Prisma/SQLite to the Next.js app.
- Before coding Next.js APIs: read the guide under `node_modules/next/dist/docs/` — this Next version differs from training data (`AGENTS.md`).
- After durable UI/behavior changes: update `second-brain/Current/Current-Context.md` (and FEAT / Lessons if needed).
