---
type: decision
status: active
tags: [area/backend, area/frontend, area/google]
created: 2026-09-27
updated: 2026-09-27
related: ["[[0021-founder-not-owner-leads-self-claim]]", "[[0023-founder-setup-google-check-before-owner]]", "[[Architecture-Overview]]"]
---

# ADR-0024: Work accounts can connect their own Drive by consent

## Status
`active`

## Context
Two different Drive connections exist and were being conflated:
- **Company connection**: a Google Workspace Super Admin authorizes Knohow's service account in Google Admin (domain-wide delegation, `/delegation/*`, setup's `DelegationConnectStep`). Reaches every work account's My Drive and shared drives.
- **Own-Drive connection**: one person grants Google's consent (`/auth/personal-oauth/start`). Reaches that person's My Drive only.

`get_drive_client_for_user` sent every `domain_delegated` member to delegation only, so a work account could not use its own consent, and the Workspace screen's "Connect your Google Drive" button had nothing to call for them. The user (2026-09-27) chose: anyone can connect their own Drive; work accounts fall back to it until the company connection exists.

## Decision
- `drive_client._client_for`: a `domain_delegated` member uses delegation when it is approved; on `DelegationNotApproved`, if they have an `oauth_credential`, their own consent is used. Personal-account members are unchanged and are never routed to delegation.
- The Workspace screen's "Connect your Google Drive" calls `startDriveConsent()` → `/auth/personal-oauth/start`; the callback now returns to `/workspace?drive_connected=1`.
- Consent still requires the Google account to match the member's own email (`complete_personal_oauth_consent`).

## Alternatives considered
- **Personal Gmail accounts only**: offered, not chosen; work accounts would wait on the Super Admin.
- **Route the button to the Super Admin connection**: wrong connection (tried and reverted 2026-09-27).

## Consequences
- Every engine using `get_drive_client_for_user` (DeepSearch, transfers, offboarding) can now act on a work account through that person's own consent while the company connection is missing.
- Work accounts using own consent hit Google's unverified-app user cap for the restricted `drive` scope (see `backend/docs/gcp-setup.md`); delegation does not.
- Tests: `backend/tests/test_drive_client_routing.py`.
