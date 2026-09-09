---
name: update-second-brain
description: >-
  Writes finished work back into the Knowhow second-brain Obsidian vault
  (Current-Context, ADRs, Known-Issues, Lessons-Learned, feature specs).
  Use after completing any non-trivial task, when shipping a feature, fixing
  a bug, making an architecture decision, learning something non-obvious,
  changing priorities, or when the user asks to update the knowledge base /
  second-brain / vault.
---

# Update second-brain after work

Mandatory write-back into `second-brain/` when work finishes. Do not end the turn until the vault matches what just became true.

## When this applies

Run this after any of:
- Code or config change that alters behavior, architecture, or priorities
- Bug found or fixed
- Feature shipped or specced
- Architecture / stack / deploy decision
- Non-obvious lesson learned
- User says work is done, or asks to update the knowledge base

Skip only for trivial pure Q&A with no durable facts (e.g. "what does this function do?" with no repo change).

## Workflow

1. **Read first** — open `second-brain/Current/Current-Context.md` and any note you are about to edit. Prefer editing an existing note over creating a new one. Link with `[[Note-Name]]`; never duplicate a fact that already lives elsewhere in the vault.

2. **Route the write** — apply every matching row:

| What happened | Where to write |
|---|---|
| Priorities / active work / open questions changed | `second-brain/Current/Current-Context.md` (always touch this when work changes what's true *now*) |
| Architecture / stack / deploy decision | New ADR in `second-brain/Architecture/Decisions/` from `second-brain/Templates/ADR.md`. Next ID = 1 + highest existing `NNNN`. Supersede old ADRs; do not edit historical decisions in place. Update `Architecture-Overview.md` if the system shape changed. |
| Bug found or fixed | `second-brain/Engineering/Known-Issues.md` (Open vs Recently resolved). Promote to `Engineering/Bugs/` via `Templates/Bug-Report.md` only if user-impacting enough. |
| Non-obvious lesson | Append dated entry to `second-brain/Engineering/Lessons-Learned.md` |
| Feature shipped or specced | Add/update `second-brain/Product/Features/FEAT-*.md` from `Templates/Feature-Spec.md` |

3. **Frontmatter** — every note keeps YAML: `type`, `status`, `tags`, `created`, `updated`, `related`. Bump `updated` to today (`YYYY-MM-DD`) on every edit.

4. **Done check** — before the final user-facing reply:
   - [ ] `Current-Context.md` reflects the new reality (or explicitly unchanged)
   - [ ] Matching ADR / Known-Issues / Lessons / FEAT rows above are done
   - [ ] No duplicated facts; links used instead
   - [ ] Templates used for any new ADR / FEAT / Bug note

## Conventions

- Vault README: `second-brain/README.md`
- Entry point also documented in `CLAUDE.md` (keep skill + CLAUDE in sync if write-back rules change)
- Daily notes (`Daily/YYYY-MM-DD.md`) are optional; use only if the user wants a day log

## Anti-patterns

- Ending the turn with only a chat summary and no vault edit when durable facts changed
- Editing an old ADR instead of superseding it
- Creating a new note when extending `Current-Context`, `Known-Issues`, or `Lessons-Learned` would do
- Writing secrets, `.env` values, or credentials into the vault
