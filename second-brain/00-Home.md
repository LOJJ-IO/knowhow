---
type: index
status: active
tags: []
created: 2026-08-31
updated: 2026-08-31
related: []
---

# Knowhow — Home

Entry point for both humans and AI agents. Start here, then follow links.

## Right now

- [[Current-Context]] — active work, open questions, what Claude should know before touching this repo today

## Engineering MOC

- [[Architecture-Overview]] — system design, how the pieces fit
- [[Known-Issues]] — current bugs/limitations not yet fixed
- [[Lessons-Learned]] — non-obvious gotchas hit while building this
- Architecture Decisions → [[Architecture/Decisions]] folder, chronological ADRs

## Product MOC

- [[Product-Vision]] — why this product exists, who it's for
- [[FEAT-org-chart-builder]] — organization/team setup
- [[FEAT-doc-visibility-dashboard]] — the core problem/solution: doc sharing visibility
- [[FEAT-onboarding-offboarding-automation]] — the differentiator: automated access lifecycle

## Research & Meetings

- [[Research]] folder — spikes, comparisons, external investigation
- [[Meetings]] folder — decisions and notes from syncs

## Logs

- [[Daily]] folder — one note per working day
- [[Weekly]] folder — weekly rollups

---

### For AI agents reading this first

1. Read [[Current-Context]] — highest-signal, most current file in the vault.
2. If the task touches architecture (data model, auth, Google integration), check [[Architecture-Overview]] and [[Architecture/Decisions|ADRs]] before proposing a new approach.
3. If the task touches a known bug or pattern, check [[Known-Issues]] first.
4. When you finish non-trivial work, write back: update [[Current-Context]], add/update an ADR or feature spec, and note anything non-obvious in [[Lessons-Learned]].
