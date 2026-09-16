---
type: decision
status: active
tags: [area/backend, ml, privacy]
created: 2026-09-16
updated: 2026-09-16
related: ["[[FEAT-drive-file-classification]]", "[[0004-fastapi-backend-for-auth-and-identity]]"]
---

# ADR-0005: Classify company vs personal files with rules and a lightweight model first; LLM only as last mile

## Status
`active` — adopted as direction by the user 2026-09-16. Nothing implemented yet.

## Context
Knowhow needs to tell which files in an employee's Drive are organizational knowledge vs personal ([[FEAT-drive-file-classification]]). Employees can have tens of thousands of files, contents are sensitive, and Knohow's security posture is that document contents stay in the client's Drive (`FileIndex` is metadata-only). The problem is a narrow classification task, not open-ended understanding.

## Decision
Applies to onboarding file review **and DeepSearch**. Build progressively: **deterministic metadata rules → lightweight metadata classifier → deeper content analysis only for remaining uncertain files → LLM optional last mile**, with human review deciding. Classification output is a suggestion with explainable signals and never authorizes moving/transferring a file — authorization stays a separate system.

## Alternatives considered
- **Send every file to an LLM** — rejected: exposes contents unnecessarily, cost scales with file count, hard to evaluate (precision/recall/thresholds), opaque reasons for an "is this company property?" decision.
- **Rules only** — kept as layer 1, but rejected as the whole system: ambiguous files (`Q3 Marketing Strategy`) need a learned signal.
- **Auto-act on high confidence** — rejected: confidence is not authority; humans confirm.

## Consequences
- Formalized as 12 rules in [[FEAT-drive-file-classification]] (categories Company/Personal/External; labels not truth; `¬Confirmed(Company) → ¬InFileIndex`; Shared Drive structural exception; confirmer ≠ proposer; confidence never bypasses confirmation). Current backend sync violates the FileIndex invariant — see [[Known-Issues]].
- The same model gates **DeepSearch** results (Company only, Personal never) — so layers 1–2 must be fast enough for query-time use or precomputed; layers 3–4 run only ahead of time, never per query.
- Accuracy must be **measured** at each layer before adding the next (how much metadata alone resolves is unknown).
- Need labeled data from user confirmations → privacy/consent position for storing features and labels, especially across organizations.
- Explainability constrains model choice toward models whose signals can be surfaced.
- Discovery uses the narrower `drive.metadata.readonly` scope; full `drive` only when acting.
- **Terms:** *Private* = company file restricted from coworkers; *Personal* = the employee's own non-company file, never visible to the company and not stored as org data. Backend's `personal` flag (which implements Private) must be renamed. Full constraints in [[FEAT-drive-file-classification]].
