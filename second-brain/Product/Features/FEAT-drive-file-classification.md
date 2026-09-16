---
type: feature
status: draft
tags: [area/product, area/backend, ml, privacy]
created: 2026-09-16
updated: 2026-09-16
related: ["[[0005-layered-file-classification-no-llm-first]]", "[[FEAT-workspace-onboarding-flow]]", "[[Product-Vision]]"]
---

# FEAT: Company vs personal file classification (onboarding + DeepSearch)

## Status
`draft` — product direction from the user, 2026-09-16. Not built. Architecture principle recorded in [[0005-layered-file-classification-no-llm-first]].

## Problem
A setup employee (see [[FEAT-workspace-onboarding-flow]]) may have thousands of files in their own Drive: clearly company, clearly personal, old, shared, ambiguous. Knowhow must help find which are organizational knowledge **without assuming everything an employee owns belongs to the company**.

Goal is not "move everything Sarah owns into the company" — it's "identify likely company files, explain why, and let a human decide."

## Solution
A layered pipeline — cheapest and least invasive first; each layer only sees what the previous couldn't resolve:

1. **Deterministic rules on Drive metadata** — folder path, name, MIME type, owner / creator / last modifier, collaborators and their domains, company-domain collaborator ratio, sharing permissions, Shared Drive location, existing org folders, creation patterns. (`/Acme/HR/Employee Handbook` → company; `/Personal/Vacation Photos/` → personal; `Q3 Marketing Strategy` → ambiguous.)
2. **Lightweight classifier on metadata features** — output `company` / `personal` / `uncertain` with a probability. No text generation, no content required.
3. **Deeper content analysis** — only for files still uncertain, only when justified.
4. **LLM** — optional last mile, not the foundation. Then **human review**.

Outcome is always a **suggestion with reasons**, e.g. "Likely company-related, 94% — in `/Acme/Marketing`, shared with 5 Acme employees, created by an Acme Workspace account." User confirmations/rejections become labeled data for improving the narrow classifier over time.

## Consumers (user-confirmed 2026-09-16)
The same layered model serves **both**:
1. **Onboarding / reclaiming company files** — the review flow above.
2. **DeepSearch** — results may only include files classified **Company** (Private files still follow role visibility). **Personal** files never appear in anyone else's results; files not yet classified are excluded from other people's results by default (safe default — open question whether an "uncertain" file may show to its own owner only).

Why DeepSearch needs it: `backend/app/search/deepsearch.py` runs a Drive `fullText` query across **every member's whole Drive** and filters only by role — an unindexed file is visible to any org-wide role (`_is_visible_live`). Without classification, a leader searching "lawyer" can see an employee's Personal file title. See [[Known-Issues]].

Query-time constraints: DeepSearch is live, so layers 1–2 (metadata only, fast) can gate results at query time or be precomputed; layers 3–4 are too slow/invasive per query and should only run ahead of time. Content matching itself stays Google's (`fullText`) — Knowhow still doesn't read or persist bodies for search.

## Formal rules (agreed 2026-09-16 — the spec's source of truth)
Tested by negation; everything else in this note must agree with these.

1. **Categories: Company, Personal, External.** Every file is exactly one. External = owned by someone outside the org (e.g. a client's file shared with Sarah) — not Acme's to claim, not Sarah's to mark Personal.
2. **Labels are decisions, not ground truth.** Knowhow never knows the truth, only labels. Rules are stated over labels (`Label(Personal)`, `Confirmed(Company)`).
3. **Unconfirmed files cannot enter `FileIndex`:** `¬Confirmed(Company) → ¬InFileIndex`. Hence `InFileIndex → Confirmed(Company)`, and `Label(Personal) → ¬InFileIndex`.
4. **Strong evidence can recommend, never confirm:** `S_C → Recommend(Company)`, `S_C ↛ Company` (same for `S_P`).
5. **Shared Drive ownership is a structural exception:** `InOrgSharedDrive → Company` — owned by the organization in Google itself; skips evidence and confirmation.
6. **Confirmer ≠ proposer:** `Confirms(x, f) → x ≠ Proposer(f)`, except an explicit one-person-company / owner exception.
7. **Conflicts get AskAgain, not an arbitrary winner** — whether evidence conflicts with itself (`S_C ∧ S_P` → ask, no pre-selected answer) or with the employee's decision (see decision table).
8. **`AskAgain ∧ SameAnswer → Accept`** — prevents infinite loops.
9. **Workspace domain needs both:** `VerifiedIdentity ∧ hd_claim → VerifiedDomain`. A verified Gmail identity has no domain and can't create an organization.
10. **Existing organizations trigger access requests, not creation:** `ExistingOrg(D) → RequestAccess ∧ ¬CreateOrg`.
11. **Authorization stays separate from classification:** `Company ∧ Authorized → CanManage`; `Company ↛ Authorized`.
12. **Pipeline:** Identity → Evidence → Classification → Confirmation → Authorization → Action. Shared Drive structure may bypass evidence/confirmation for Company ownership; **confidence never bypasses confirmation**.

Company is therefore established only by: `(Proposed(Company) ∧ Confirmed_by(L) ∧ L ≠ Proposer) ∨ InOrgSharedDrive`.

### Decision table (after the employee answers)
| Evidence | Employee says Company | Employee says Personal |
|---|---|---|
| `S_C` only | Company candidate → confirmation | **AskAgain** |
| `S_P` only | **AskAgain** | Accept Personal |
| Neither (`U`) | Company candidate → confirmation | Accept Personal |
| Both strong | Company candidate → confirmation | Accept Personal |

Before the employee answers, `U` and both-strong present no pre-selected answer (both-strong shown as conflicting evidence). External files aren't offered as Company or Personal.

## Decision flow (agreed 2026-09-16)
Not "model says X → do X". It's **evidence → recommendation → human decision → contradiction check**.

| Evidence | Recommendation shown to the employee |
|---|---|
| Strong company signal | Propose **Company** ("This looks like a company file") |
| Strong personal signal | Propose **Personal** ("This looks like a personal file") |
| Neither strong | **Ask** ("We don't have enough evidence") — no pre-selected answer |

Contradiction checks after the employee decides:
- **Says Personal, company signals strong** → ask the employee again (prompt to them only; see constraint 4).
- **Says Company, personal signals strong** → ask the employee again *before* it goes to owner/leader review — otherwise a mis-click sends a personal file's title to the leader.
- Ask again **once**. If the employee confirms, their answer stands (Personal is final; Company proceeds to confirmation). No repeated nagging.

## Principles (non-negotiable for this feature)
1. Don't use AI because it's available — rules first.
2. Don't read contents unless metadata can't decide.
3. Smallest model that works.
4. **Confidence ≠ authority** — 99% company-related does not authorize moving the file. Classification and authorization are separate systems.
5. Human confirms, especially for anything currently in an employee's Drive.
6. Build progressively and **measure** (precision, recall, false positives/negatives, thresholds; what share metadata alone resolves) — no assumed percentages.

## Out of scope
- Automatically transferring ownership on classification alone.
- General-purpose AI features.

## UI/UX
Not designed. Direction: "We found 43 files that may belong to Acme" review list with per-file label, confidence, reasons, and a Review action.

## Technical approach
Relevant existing backend (as of 2026-09-16):
- `FileIndex` is **metadata only, never contents** (`backend/app/models/file_index.py`) — consistent with this feature; layer 3 must not persist contents either.
- DeepSearch queries Drive live and persists nothing from bodies.
- Scopes: backend currently requests full `drive` everywhere (needed for ownership/permission changes); constraint 6 means classification must use `drive.metadata.readonly` instead.

## Terms (decided 2026-09-16)
- **Private** = a **company file**, restricted from coworkers (leaders with background access still see it). This is what the backend's existing `sharing_state.personal` / `mark_file_personal` actually implements — that code is **misnamed** and must be renamed to "private" before this feature is built (see [[Known-Issues]]).
- **Personal** = **the employee's own non-company file** (e.g. Sarah's). Not company property; the company — leaders included — never sees it.
- **External** = owned by someone outside the organization (e.g. a client's file shared into Sarah's Drive). Neither Company nor Personal.
- Never use "personal" for a company file, in code, API, UI copy, or notes.

## Agreed constraints (user-confirmed 2026-09-16)
1. **Distinct terms** — Private vs Personal as above; conflating them would expose Personal files to leaders.
2. **Personal files are not stored as org data.** `FileIndex.org_id` is required, so a row implies company data. Files classified (or confirmed) Personal get no `FileIndex` row. Unclassified candidates need their own handling, not `FileIndex`.
3. **Metadata is private too — minimize what's inspected and what's retained.** A filename (`Divorce Lawyer.pdf`) or folder (`Medical Records`) reveals something sensitive without opening the file. Two separate questions:
   - **Inspect (temporary):** the classifier may look at the minimum it needs — filename, folder path, owner, collaborators — in memory, for the duration of classification.
   - **Retain (permanent):** only for files that belong to the company. A file classified **Personal** keeps nothing — its filename, path and other metadata are discarded once classified.
   - "Discarded" includes the accidental copies: application logs, error reports/traces, queues or job payloads, caches, analytics, and training data (features derived from a Personal file's name are still that name). None may carry a Personal file's metadata.
   - Goal: **use the minimum information necessary, and don't retain information about files that don't belong to the company** — especially when scanning an employee's existing Drive.
4. **Employee proposes, company confirms; Personal stays private.** Neither the classifier nor the employee is the final authority on company property.
   - **Chain:** classifier suggests → employee proposes ("I think these are company files") → owner/leader confirms ("yes, these are company files"). Only confirmed files become company property.
   - **Why not the employee alone:** `Notes from meeting.docx` marked Personal may hold company information; `My Portfolio.docx` marked Company may be a personal career document.
   - **Asymmetry:** Company proposals go to organizational review. Files the employee marks **Personal are excluded from organizational visibility** — never shown to the owner/leader "to check", since that defeats the privacy purpose.
   - **Accepted risk:** a real company file wrongly marked Personal stays hidden from Knowhow's company view. Privacy wins. Mitigation that doesn't expose the file: when strong company signals exist (e.g. already shared with several company-domain coworkers), ask **the employee** to re-check — the prompt goes to them only. Note this is Knowhow's visibility only; it doesn't change who owns the file in Google Workspace.
5. **Training data needs consent.** Stored features/labels from confirmations require an explicit consent and privacy position; cross-organization training especially. Per-org vs global model still to decide.
6. **Narrow scope first.** Discovery/classification pass requests `drive.metadata.readonly`; full `drive` is requested only when Knowhow must act (ownership/permission changes). Less alarming consent.
7. **Undecided files: store the ID, not the name (agreed 2026-09-16 — apply in future builds).** A file the layers can't settle yet isn't known to be Personal (so it can't be discarded) or Company (so it mustn't be retained in full). Store only the **Drive file ID + classification (label, confidence) + reason codes**. Reason codes are structured (e.g. `company_domain_collaborators: 5`), never free text quoting the filename or path. When someone opens the review screen, **fetch the title/path live from Google** and don't persist it. Unreviewed entries are deleted after a fixed period (length TBD).

## Open questions
- DeepSearch: classify ahead of time (index) vs gate live results with layers 1–2 per query; may an unclassified file show to its own owner; does the model also help **rank** results, or only gate them.
- Retention period for unreviewed undecided entries (constraint 7).
- Per-org vs global classifier; consent UX and wording.
- What the confirming owner/leader sees of a proposed file before accepting (enough to decide, nothing more).
- Content-derived features (keywords in content) belong to layer 3, not the metadata classifier; document length is Drive metadata and fine.

## Related
[[0005-layered-file-classification-no-llm-first]] · [[FEAT-workspace-onboarding-flow]] · [[Product-Vision]]
