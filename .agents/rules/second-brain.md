---
trigger: always_on
description: ALWAYS read and write the Knowhow second-brain vault every turn. Mandatory memory.
---

# Second-brain — ALWAYS find · read · write

**Vault root:** `second-brain/` (repo root). **Not optional. Not deferrable.**

A PreInvocation hook (`.agents/hooks.json` → `scripts/second-brain-pre.py`) injects `Current/Current-Context.md` every model turn. That does **not** replace opening/editing the real files when you change them.

## ALWAYS find

- Entry: `@../../second-brain/Current/Current-Context.md`
- Home: `@../../second-brain/00-Home.md`
- ADRs: `@../../second-brain/Architecture/Decisions/`
- Bugs/lessons: `@../../second-brain/Engineering/Known-Issues.md` · `@../../second-brain/Engineering/Lessons-Learned.md`
- Features: `@../../second-brain/Product/Features/`
- Skill: `@../skills/update-second-brain/SKILL.md`

## ALWAYS read (before non-trivial work)

1. `Current/Current-Context.md` — priorities, what’s true now, open questions
2. Architecture / auth / Google / onboarding → Architecture-Overview + relevant ADRs
3. Known bugs/patterns → Known-Issues + Lessons-Learned
4. Feature work → existing `FEAT-*.md` if any

Treat vault facts as more authoritative than chat memory. Never ask the user to restate something that already lives in the vault — link `[[Note-Name]]` instead.

## ALWAYS write (after durable work — same turn)

| What happened | Where |
|---|---|
| Priorities / what’s true now | `Current/Current-Context.md` (**always** when reality changed) |
| Architecture decision | new ADR from `Templates/ADR.md` — **supersede**, don’t edit old ADRs |
| Bug found/fixed | `Engineering/Known-Issues.md` |
| Non-obvious lesson | append `Engineering/Lessons-Learned.md` |
| Feature shipped/specced | `Product/Features/FEAT-*.md` from `Templates/Feature-Spec.md` |

**Do not end the turn** until the vault matches what just became true. Skip write-back only for pure Q&A with no durable facts.

## Hygiene

- YAML frontmatter on every note: `type`, `status`, `tags`, `created`, `updated`, `related` — bump `updated`
- Prefer editing an existing note over creating a new one
- No secrets / `.env` values in the vault
