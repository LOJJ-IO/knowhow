# Knowhow — Engineering Second Brain

This is not a note-taking vault. It is **external memory for AI coding agents** (Claude Code, Cursor) and for you. The goal: you should almost never have to re-explain context to Claude — Claude should retrieve it from here, and should write back to it as work happens.

Open this folder (`second-brain/`) directly as an Obsidian vault (`File → Open folder as vault`).

This vault follows the same conventions as [Sage's second-brain](../../Sage_v1/second-brain/README.md) (Knowhow started as a spinoff conversation from that repo) — same folder map, same frontmatter standard, same read-before/write-after discipline. It is otherwise a fully independent vault for a fully independent product.

## How this works

1. **Claude reads before it acts.** At the start of a task, check [Current/Current-Context.md](Current/Current-Context.md) and any linked notes before asking for context.
2. **Claude writes as it goes.** Architecture decisions, bugs, shipped features, and non-obvious lessons get written back here — not just left in chat. Enforced for Cursor via project skill `.cursor/skills/update-second-brain/`, rule `.cursor/rules/update-second-brain.mdc`, and a `stop` hook in `.cursor/hooks.json`.
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
- **Name who did it.** Two people work in this repo. Every entry you write says who asked for or did the work, by name, never just "the user":
  - **Ronald** (git `ronaldwopara`, Mac)
  - **Tolu** (git `tolulase007`, Windows; owner of the Railway project, co-owner of GCP `knohow-staging`)

  Tell who you're working for from `git config user.name` (or the machine). Write it inline with the date, e.g. "(Tolu, 2026-10-02)" or "Tolu added the redirect URI". Entries from before 2026-10-02 that say "the user" are ambiguous: don't guess who it was.

  **Working for Tolu (git `tolulase007`)? Write fuller entries** (Ronald asked, 2026-10-02). Ronald reads them to catch up on work he didn't see happen, so a one-liner isn't enough. Each entry covers:
  1. **What changed:** the behaviour, screen or service, in plain words.
  2. **Why:** what Tolu asked for or what problem it fixed.
  3. **Where:** files, routes, migrations, env vars, Railway/GCP settings touched (no secret values).
  4. **How it was checked:** tests run and their result, or what was clicked through. Say so if nothing was verified.
  5. **What's left:** open problems, and anything Ronald has to do or decide.

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
