# Scope lists requested from Google. Every entry here must have a reason — see
# backend/docs/gcp-setup.md for which of these are Google "restricted scopes"
# requiring OAuth verification review before the unverified-app user cap lifts.

# Requested on the app-login flow only (any member, any auth_type). Identifies
# who is signing in to Knohow; grants no Drive capability at all.
LOGIN_SCOPES: list[str] = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

# Full, unscoped-by-file Drive access.
#
# Why not drive.file or drive.metadata (the narrower, non-restricted scopes)?
# Knohow's core function is managing ownership and sharing on files members
# created themselves, anywhere in their Drive, including files that existed
# long before Knohow ever saw them. drive.file only grants access to files
# Knohow itself created or the user explicitly opened with Knohow — it cannot
# see or touch a file a member dropped in their Drive independently, which is
# the normal case this product exists to handle. drive.metadata can read
# structure but cannot change ownership or permissions. Only the full `drive`
# scope covers both discovery and mutation of pre-existing files.
#
# This is a Google "restricted" scope: it requires the OAuth consent screen to
# pass Google's verification review (including a security assessment for apps
# above the installs/user threshold) before it can be used outside a small
# test-user allowlist. See docs/gcp-setup.md — submit that review immediately,
# it runs on Google's timeline, not ours.
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"

# Scopes requested from the Workspace super-admin when authorizing domain-wide
# delegation for the service account (granted in the Admin console, not via an
# OAuth consent screen). Impersonation is hard-scoped per organization at the
# function boundary — see app/auth/delegation.py — this list only controls
# what the impersonated call is *capable* of once that boundary is passed.
DOMAIN_DELEGATION_SCOPES: list[str] = [DRIVE_SCOPE]

# Scopes requested on the per-user consent flow for personal-account members
# (see app/auth/personal_oauth.py). Requesting `access_type=offline` alongside
# this at the flow level is what yields a refresh token to store.
PERSONAL_OAUTH_SCOPES: list[str] = [DRIVE_SCOPE]
