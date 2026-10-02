---
type: decision
status: active
tags: [area/backend, area/frontend, area/google, identity, privacy]
created: 2026-09-27
updated: 2026-09-27
related: ["[[0012-identity-linking-one-person-many-accounts]]", "[[0024-own-drive-consent-for-work-accounts]]", "[[FEAT-drive-file-classification]]"]
---

# ADR-0025: A linked personal account's Drive shows on its owner's Workspace screen

## Status
`active`. Narrows [[0012-identity-linking-one-person-many-accounts]]'s "data stays per account" for one read-only view; everything else in 0012 stands.

## Context
The user (2026-09-27): "if you link your personal account you should be able to see the personal account files as well". 0012 keeps each account's data in its own place, and a linked personal address usually has no membership (`PersonEmail`), so there was nowhere to hold Drive consent for it.

## Decision
- New table `linked_drive_credentials` (migration `0019`): Drive consent keyed by **person + address**, refresh token Fernet-encrypted.
- `GET /auth/linked-drive/start?email=` → Google consent with `login_hint`; refused (403) unless the address is linked to the caller's person (`PersonEmail`, or another personal-account `OrgMember` of the same person). The callback (`linked_drive` state purpose on the shared `/auth/callback`) refuses a Google account whose email differs, stores the credential, returns to `/workspace?drive_connected=1`.
- `GET /organizations/{org_id}/linked-drive-previews` → the caller's linked accounts, each with recent files if connected. **Only the caller's own links, read live, never stored, never in `FileIndex`, never shown to anyone else.**
- Workspace screen: a "Personal account" section per linked address, with its files or **Connect this Drive**.
- Audit: `linked_drive.consent_granted` records that a linked account was connected, not which address.

## Alternatives considered
- **Keep them separate (switch to the personal workspace to see its files)**: offered, not chosen.
- **Reuse `oauth_credentials`**: keyed by `member_id`, and a linked address usually has no member.

## Consequences
- The same restricted `drive` scope and unverified-app user cap as [[0024-own-drive-consent-for-work-accounts]].
- Unlinking an address doesn't yet delete its `linked_drive_credentials` row (reads stop, because every read re-checks the link). Clean-up on unlink is open.
- Tests: `backend/tests/test_linked_drive.py`.
