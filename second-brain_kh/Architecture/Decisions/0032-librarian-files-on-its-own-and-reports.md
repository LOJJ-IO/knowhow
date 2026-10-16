---
type: decision
status: active
tags: [area/backend, area/product, librarian, privacy]
created: 2026-10-02
updated: 2026-10-02
related: ["[[0028-rules-based-librarian-knohow-folders]]", "[[0029-workspace-files-are-company-by-default]]", "[[FEAT-drive-file-classification]]", "[[0026-notifications-tasks-and-updates]]", "[[FEAT-legal-pages]]"]
---

# ADR-0032: The librarian is your assistant: it puts things in place, then tells you

## Status
`active` (Ronald, 2026-10-02). **Not built.** Refines [[0028-rules-based-librarian-knohow-folders]] and [[0029-workspace-files-are-company-by-default]].

## Context
Ronald (2026-10-02): the librarian is "your friend, your employee". Its only job is to take whatever you create and put it in the right place, then tell you about it. Like a librarian after a field trip wrecked the library: this goes here, that goes there, here's what I moved. You open the app and find what you're looking for.

The built version asks someone to confirm every file, looks at only the 500 newest, and runs only when started. That makes the person do the librarian's job.

## Decision
**The librarian keeps your Drive making sense inside the app, by itself.**
- It files every company file, old and new, into the right team folder, and tells you what it did.
- You never have to approve its work. Anything it got wrong, you move or mark Private from its report.
- When a screen needs a decision (offboarding, transfers, ownership, sharing), the librarian has already done the legwork and suggests the answer.
- Folders exist only in the app. Google Drive is never changed.

## Consequences
Follow-up work, no further decisions needed:
- Rewrite the Privacy Policy (`/privacy`) and [[FEAT-drive-file-classification]] so they describe this (Workspace files are the company's, like a Shared Drive, and need no confirmation).
- Drop propose → confirm for Workspace files in `backend/app/librarian/service.py`; file new files as they're created (`handle_file_created` in `backend/app/sharing/service.py`).
- The report goes through [[0026-notifications-tasks-and-updates]].
- Personal Gmail files still come in through the Picker; once in, the librarian files them like anything else.
