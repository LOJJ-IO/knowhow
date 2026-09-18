---
name: update-second-brain
description: >-
  ALWAYS use after any durable Knowhow work: write Current-Context, ADRs,
  Known-Issues, Lessons-Learned, or FEAT specs into second-brain/. Also use when
  the user mentions second-brain, vault, ADR, or knowledge base. Mandatory
  write-back — do not end the turn until the vault matches reality.
---

# Update second-brain (mandatory write-back)

Vault: `second-brain/`. Same workflow as `.cursor/skills/update-second-brain/SKILL.md`.

## When

After any of: code/config that changes behavior; bug found/fixed; feature shipped/specced; architecture decision; non-obvious lesson; priority change; user asks to update the vault.

Skip only pure Q&A with no durable facts.

## Steps

1. Read `second-brain/Current/Current-Context.md` (and any note you will edit).
2. Route writes:

| What | Where |
|---|---|
| What’s true / priorities / open questions | `Current/Current-Context.md` |
| Architecture decision | new ADR in `Architecture/Decisions/` from `Templates/ADR.md` (supersede, don’t edit old) |
| Bug | `Engineering/Known-Issues.md` |
| Lesson | append `Engineering/Lessons-Learned.md` |
| Feature | `Product/Features/FEAT-*.md` from `Templates/Feature-Spec.md` |

3. Link `[[Note-Name]]`; keep YAML frontmatter; bump `updated`.
4. Done check: vault matches what just became true before you stop.
