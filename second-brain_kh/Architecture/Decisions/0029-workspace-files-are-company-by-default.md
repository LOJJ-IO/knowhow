---
type: decision
status: active
tags: [area/backend, area/product, librarian, privacy]
created: 2026-09-29
updated: 2026-09-29
related: ["[[0028-rules-based-librarian-knohow-folders]]", "[[FEAT-drive-file-classification]]", "[[0005-layered-file-classification-no-llm-first]]", "[[Current-Context]]"]
---

# ADR-0029: Workspace files are Company by default; the company/personal classifier is only for personal-Gmail imports

## Status
`active` (user decision, 2026-09-29; **built same day**). Refines [[0028-rules-based-librarian-knohow-folders]] and supersedes the part of [[FEAT-drive-file-classification]] that had the librarian guess company-vs-personal for **Workspace** accounts.

## Context
The librarian's first layer (`backend/app/librarian/rules.py`) decides *company vs personal* for every scanned file from **sharing** signals: shared with coworkers / the domain / edited by a coworker → company; shared only with free-mail contacts → personal; both or neither → unsure. That logic was written under the older spec premise "don't assume everything an employee owns belongs to the company."

But that premise conflates two very different account types:
- **Google Workspace account** (e.g. `@knohow.app`): Google itself makes the organization the owner of every file — the Workspace admin already owns it. There is no "personal" file here in an ownership sense, so guessing company-vs-personal is wasted effort and a source of **false "personal" calls** that hide real company work.
- **Personal Gmail** (the "first Workspace" migration / Picker import — [[0028-rules-based-librarian-knohow-folders]], Current-Context 2026-09-29): the files are legally the person's and only *some* are work. Here the company-vs-personal question is real.

Privacy for Workspace accounts is still a concern — a person may not want a sensitive company file (e.g. an HR complaint) surfaced org-wide in DeepSearch — but that is what **Private** already means in the spec: a *company* file restricted from coworkers ([[FEAT-drive-file-classification]] → Terms). It does not require pretending the file is "personal."

## Decision
1. **A file in a Workspace account defaults to Company.** The librarian does not interrogate Workspace files with the company-vs-personal classifier. They are the organization's, per Google's own ownership.
2. **The share-based classifier (`rules.py`) is scoped to personal-Gmail imports** — the one context where a file's owner is a consumer account and the company/personal split is genuine.
3. **Private stays the escape hatch** for a sensitive *company* file the person wants hidden from coworkers (leaders with background access still see it). This preserves privacy without mislabelling ownership.
4. **The librarian's job for Workspace accounts becomes organization, not classification** — filing company files into the right team folder (see "Consequences" → next capability: retroactive team-folder routing).

## Alternatives considered
- **Keep classifying Workspace files** (status quo) — rejected: it nags the person through hundreds of files whose answer is always "company," and any wrong "personal" call silently drops real company work out of Knohow's view.
- **Auto-mark everything company with no Private option** — rejected: removes the privacy valve for genuinely sensitive company files; DeepSearch would surface titles the person reasonably wants restricted.
- **Delete the classifier entirely** — rejected: it is exactly right for personal-Gmail imports, where ownership is the person's.

## Consequences
- Workspace onboarding gets dramatically less naggy: "these are all your company's files — help us file them into teams and flag anything to keep Private," instead of a company/personal quiz.
- **Built 2026-09-29:** `scan_member_drive` now calls `rules.classify_workspace` (always Company + company reason counts as context); `rules.classify` is retained for the future personal-Gmail scan and still unit-tested. Because a Workspace file now suggests Company, marking one Personal goes against the suggestion and gets the existing AskAgain once (the person can still confirm Personal). Tests updated in `tests/test_librarian.py`.
- **Team-folder routing built 2026-09-29** (the user's chosen next capability): `confirm` now routes a file to the team most of its **org-domain collaborators** are on (`_route_team` + `rules.org_collaborator_emails`), falling back to the proposer's own team when there's no signal; a tie that includes the proposer's team resolves to it. Collaborator emails are mapped to teams in memory and never stored. **Still not done:** Drive-folder-name and **Shared Drive → team** routing (Shared Drive files are still skipped by rule 5); a full Drive re-scan/re-file pass; auto-confirm for Workspace files (they still go through propose→confirm rather than bypassing it like `InOrgSharedDrive`).
- The formal rules in [[FEAT-drive-file-classification]] (categories Company/Personal/External; `InFileIndex → Confirmed(Company)`; confirmer ≠ proposer) still hold; what changes is that **Workspace files reach "Company" without the evidence quiz**, much like `InOrgSharedDrive → Company` already bypasses it.

## Related
- Refines [[0028-rules-based-librarian-knohow-folders]]; supersedes the Workspace-classification portion of [[FEAT-drive-file-classification]].
- Code: `backend/app/librarian/rules.py`, `backend/app/librarian/service.py`, `backend/app/librarian/import_personal.py`.
