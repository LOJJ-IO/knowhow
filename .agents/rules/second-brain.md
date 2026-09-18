---
trigger: always_on
description: Second-brain vault read/write discipline for every durable change.
---

# Second-brain (mandatory memory)

Vault root: `second-brain/`. Not optional.

## Before non-trivial work

1. Read `@../../second-brain/Current/Current-Context.md`
2. System design / auth / Google / onboarding → `@../../second-brain/Architecture/Architecture-Overview.md` + ADRs
3. Bugs / patterns → `@../../second-brain/Engineering/Known-Issues.md` · `@../../second-brain/Engineering/Lessons-Learned.md`
4. Features → `@../../second-brain/Product/Features/`

## After non-trivial work (same turn — do not defer)

| What happened | Where |
|---|---|
| Priorities / what’s true now | `Current/Current-Context.md` |
| Architecture decision | new ADR in `Architecture/Decisions/` from `Templates/ADR.md` — **supersede**, don’t edit old ADRs |
| Bug found/fixed | `Engineering/Known-Issues.md` |
| Non-obvious lesson | append `Engineering/Lessons-Learned.md` |
| Feature shipped/specced | `Product/Features/FEAT-*.md` from `Templates/Feature-Spec.md` |

## Vault hygiene

- Link with `[[Note-Name]]` — never duplicate a fact that already lives in the vault.
- Keep YAML frontmatter (`type`, `status`, `tags`, `created`, `updated`, `related`); bump `updated`.
- Prefer editing an existing note over creating a new one.
