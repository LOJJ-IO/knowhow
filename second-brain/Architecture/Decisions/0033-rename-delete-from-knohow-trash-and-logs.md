---
type: decision
status: active
tags: [area/backend, area/frontend, google, deletion]
created: 2026-10-04
updated: 2026-10-04
related: ["[[0010-deletes-go-to-trash-30-days]]", "[[0028-rules-based-librarian-knohow-folders]]", "[[FEAT-core-app-screens]]"]
---

# ADR-0033: Files and folders rename / delete from a click pop-over; deleted files restore from Settings' Trash; Settings has Logs

## Status
`active`. Ronald, 2026-10-04 (voice note + clarifying questions).

## Context
Ronald wanted a left click on a file or folder in Workspace to show Rename and Delete (each with an icon), with Rename opening its own dialog. Delete on a file should move it to Drive's trash, and Settings should get a Trash and Logs. [[0010-deletes-go-to-trash-30-days]] already said deletes only trash, but left the restore UI "not designed".

## Decision
- **Click = pop-over, double-click = open** for folders (Ronald picked this). Enter on a focused folder still opens it. Files: click (or Enter on a details row) = pop-over.
- **Who:** a file's owner, a lead of its team, the org owner or a verified Super Admin (Ronald picked "owner, lead, top"). Custom folders: whoever made it, the owner or a Super Admin (unchanged delete rule). Team folders can't be renamed or deleted; their pop-over shows both greyed out. Others see the items greyed out too.
- **Rename a file** renames it in Google Drive through the owner's Drive client (the actor may only be a Drive viewer). **Delete a file** = `files.update(trashed=true)` through the owner (never `files.delete`, per ADR-0010). `file_index.trashed_at` / `trashed_by` (migration `0024`) hide it from folders, Add files and Ownership; its folder links stay, so Restore puts it back where it was.
- **Settings → Trash:** files you may manage that were trashed through Knohow in the last 30 days, with who deleted them, days left and Restore (`files.update(trashed=false)`).
- **Settings → Logs:** the org's audit log, newest 200, as "What · subject / who / when". Owner and Super Admins only (backend 403s others), since it is the whole org's history.
- New audit actions: `document.renamed`, `document.trashed`, `document.restored`, `folder.renamed`, `folder.deleted`.

## Alternatives considered
- **Delete = take out of the folder only:** rejected by Ronald (he wants it in Drive's trash).
- **Open as a pop-over item / pop-over on files only:** rejected by Ronald in favour of double-click.
- **Anyone who can see the file may rename/delete:** rejected (Ronald picked owner / lead / top).

## Consequences
- A file trashed directly in Drive (not through Knohow) is not in Settings' Trash; it still shows in folders until the reconciliation sweep or someone notices. Not handled.
- After 30 days Google empties the file but its `file_index` row stays (hidden, out of Trash). Nothing prunes it yet.
- Logs show raw-ish subjects (`to` / `title` / `name` from the entry's details); entries without one show just the action.
- The sandbox Drive (`app/sandbox/drive.py`) now supports rename and untrash in memory.

## Related
[[0010-deletes-go-to-trash-30-days]] · [[FEAT-core-app-screens]]
