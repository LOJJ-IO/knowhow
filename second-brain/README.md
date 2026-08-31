# Knowhow — Engineering Second Brain

This is not a note-taking vault. It is **external memory for AI coding agents** (Claude Code, Cursor) and for you. The goal: you should almost never have to re-explain context to Claude — Claude should retrieve it from here, and should write back to it as work happens.

Open this folder (`second-brain/`) directly as an Obsidian vault (`File → Open folder as vault`).

This vault follows the same conventions as [Sage's second-brain](../../Sage_v1/second-brain/README.md) (Knowhow started as a spinoff conversation from that repo) — same folder map, same frontmatter standard, same read-before/write-after discipline. It is otherwise a fully independent vault for a fully independent product.

## How this works

1. **Claude reads before it acts.** At the start of a task, check [Current/Current-Context.md](Current/Current-Context.md) and any linked notes before asking for context.
2. **Claude writes as it goes.** Architecture decisions, bugs, shipped features, and non-obvious lessons get written back here — not just left in chat.
3. **You correct in the vault, not just in chat.** If a note is wrong, edit it or tell Claude to update it.
4. **The repo's `CLAUDE.md` is the entry point.** It tells any agent working in this repo that this vault exists and how to use it.

## Folder map

| Folder | Purpose |
|---|---|
| [Current/](Current/Current-Context.md) | What's true *right now*. Highest churn, always current. |
| [Architecture/](Architecture/Architecture-Overview.md) | System design, tech stack, ADRs (why decisions were made). |
| [Product/](Product/Product-Vision.md) | Why the product exists, feature specs. |
| [Engineering/](Engineering/Known-Issues.md) | Known issues, lessons learned. |
| [Research/](Research/) | Spikes, comparisons, external reading. |
| [Meetings/](Meetings/) | Meeting notes and decisions. |
| [Daily/](Daily/) | One note per working day. |
| [Weekly/](Weekly/) | Weekly rollup. |
| [Templates/](Templates/) | Every note type's template. |

## Non-negotiables

- **Frontmatter on every note.**
- **Link, don't duplicate.**
- **Every ADR and feature spec gets a unique, never-reused ID.**

## Naming conventions

- ADRs: `Architecture/Decisions/NNNN-short-title.md`, zero-padded 4-digit sequence. Never renumber — supersede instead.
- Feature specs: `Product/Features/FEAT-short-title.md`.
- Daily notes: `Daily/YYYY-MM-DD.md`.

## Frontmatter standard

```yaml
---
type: architecture | decision | feature | bug | research | meeting | daily | weekly | context | pattern
status: draft | active | resolved | deprecated | superseded | archived
tags: [area/frontend, area/backend, ...]
created: YYYY-MM-DD
updated: YYYY-MM-DD
related: ["[[Other-Note]]"]
---
```
