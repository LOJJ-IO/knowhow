# GCP / Google Workspace setup for Knohow's auth module

This is a one-time setup a human does in the Google Cloud and Google
Workspace Admin consoles. Nothing in this document can be automated by
Knohow itself — every step below requires either GCP project ownership or
Workspace super-admin access that only the client (or Knohow's own ops
team, for the shared GCP project) holds.

**Submit the OAuth verification application (step 5) as soon as the OAuth
consent screen exists — not after development is "done."** Google's review
for a restricted scope (`.../auth/drive`, requested here) can take
multiple weeks and sometimes several review round-trips. It runs on
Google's timeline, in parallel with engineering work, not after it.

## 1. Create the GCP project

1. In the [GCP Console](https://console.cloud.google.com/), create a new
   project (e.g. `knohow-prod`, plus a separate `knohow-staging` project if
   you want isolated review/test credentials).
2. Enable these APIs for the project (APIs & Services → Library):
   - **Google Drive API** — file/ownership/permission operations.
   - **Admin SDK API** — required for admin proof (the Super Admin check at
     onboarding, `app/google/directory.py`) and by the org-engine module
     (Reports activity feed). If it's off, the Super Admin check fails with
     `?admin_proof=error` rather than a verdict.
   - **People API** (optional) — richer profile info than the basic OpenID
     userinfo endpoint, if the product wants it later.

## 2. OAuth consent screen

APIs & Services → OAuth consent screen.

- **User type**: `External` (Knohow serves multiple client organizations,
  including ones on personal Gmail accounts — `Internal` only works for a
  single Workspace org's own users).
- **App name / support email / logo**: as appropriate for the product.
- **Scopes**: add exactly the scopes below. Do not add broader scopes "to
  be safe" — every added scope widens the verification review surface.
- **Test users**: while unverified, add the developers'/pilot org's Google
  accounts here so the app can be exercised during development (capped at
  100 test users by Google, regardless of this list).

### Scopes requested, and why

| Scope | Restricted? | Used for |
|---|---|---|
| `openid`, `.../userinfo.email`, `.../userinfo.profile` | No | App login only (identifies who is signing in). Requested on every login, for every member regardless of auth_type. Grants no Drive capability. |
| `https://www.googleapis.com/auth/admin.directory.user.readonly` | Check the consent screen's classification (Admin SDK scopes may need verification) | Admin proof only (`app/onboarding/admin_proof.py`): requested from a member who says they're a Super Admin, under their own authorization, for one Directory call — their own user record's `isAdmin`. Only an admin can read it. The access token is discarded after the call. Add it to the consent screen's scope list. |
| `https://www.googleapis.com/auth/drive` | **Yes — restricted, requires verification** | Full Drive access. Requested both (a) as the domain-wide delegation scope authorized by the Workspace super-admin, and (b) on the per-user consent flow for personal-account members. |
| `https://www.googleapis.com/auth/admin.reports.audit.readonly` | **Yes — restricted, requires verification** | Org-engine module only: the Admin SDK Reports API feed of org-wide Drive activity for domain members (`app/activity/reports_feed.py`), impersonating the delegation-approving admin. Read-only; used to detect file creation/edits, never to modify anything. Deliberately used instead of one Drive push-notification "watch channel" per domain member, which would mean maintaining and renewing N expiring subscriptions per organization instead of one polled feed — see that module's docstring. |

**Why full `drive` and not the narrower `drive.file` or `drive.metadata`
scopes:** Knohow's core function is managing ownership and sharing on
files members created *before* Knohow ever saw them — a file dropped
directly in someone's Drive, not created through Knohow's own UI.
`drive.file` only grants access to files the app itself created or the
user explicitly opened with the app; it structurally cannot see
pre-existing files, which is the normal case here, not an edge case.
`drive.metadata` can read structure but cannot change ownership or
sharing. Only the full `drive` scope covers both discovery and mutation of
files Knohow didn't create.

### Google verification review

`https://www.googleapis.com/auth/drive` is a Google **restricted scope**.
Any app requesting it must pass Google's OAuth app verification, which for
restricted scopes includes:
- A standard verification review (app details, scope justification, demo
  video showing the requested data use).
- A **third-party security assessment** (e.g. an independent CASA
  assessment) once the app is used by enough end users — check the current
  threshold on Google's verification page, since Google has changed it
  over time.

Until verification completes, the app is capped at **100 test users**
across all personal-Gmail (personal-account member) consent flows — see
`app/auth/personal_oauth.py`. **This cap does not apply to domain-delegated
members** — domain-wide delegation is authorized once by the Workspace
super-admin in their Admin console (step 4 below), not through this
consent screen, so it has no per-user cap.

## 3. OAuth 2.0 client ID (Web application)

APIs & Services → Credentials → Create Credentials → OAuth client ID →
**Web application**.

- **Authorized redirect URIs**: exactly the backend's callback URLs, e.g.
  - `https://<your-railway-domain>/auth/callback`
  - `https://<your-railway-domain>/auth/personal-oauth/callback`
  - plus `http://localhost:8000/...` equivalents for local dev.
- Copy the generated **Client ID** and **Client Secret** into
  `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (Railway env vars
  in production; `.env` locally — never commit either).

## 4. Service account + domain-wide delegation

1. IAM & Admin → Service Accounts → Create Service Account (e.g.
   `knohow-delegation@<project>.iam.gserviceaccount.com`). No project IAM
   roles are needed — its authority comes entirely from Workspace
   delegation, not GCP IAM.
2. Create a JSON key for it. This key is a long-lived secret — store it as
   `GOOGLE_SERVICE_ACCOUNT_JSON` (Railway env var, or a mounted secret
   file path) and never commit it.
3. Enable **domain-wide delegation** on the service account (Service
   Accounts → this account → "Show domain-wide delegation" / enable it),
   which reveals its numeric **Client ID** (different from the OAuth
   client ID in step 3 — don't mix them up).
4. Hand the client's Workspace **super-admin** (not just the org
   owner — see the two-question onboarding split in the org-engine
   module) these instructions for their Admin console
   (admin.google.com → Security → API Controls → Domain-wide Delegation →
   Add new):
   - **Client ID**: the service account's numeric client ID from step 3.
   - **OAuth Scopes**: `https://www.googleapis.com/auth/drive` plus, for the
     org-engine module's Reports-feed activity detection,
     `https://www.googleapis.com/auth/admin.reports.audit.readonly`
     (comma-separated — keep this list in sync with
     `app/google/scopes.py::DOMAIN_DELEGATION_SCOPES` and the
     `REPORTS_SCOPE` constant in `app/activity/reports_feed.py`). The Admin
     SDK Reports API is impersonation-based the same way Drive is, so it
     needs its own scope in this same domain-wide delegation grant — it is
     not covered by the Drive scope above.
5. Nobody has to tell Knohow it's done. `GET /organizations/{org_id}/delegation/setup`
   returns exactly what to enter (service account client ID, the scope list
   from `ADMIN_CONSOLE_DELEGATION_SCOPES`, the Admin console URL) for the
   setup guide. Knohow then **detects** the grant (delegation proof,
   `app/auth/delegation.py::check_delegation`): every 5 minutes (scheduler)
   and on `POST .../delegation/check`, it mints an impersonated token as the
   org's Google-verified Super Admin for every scope, then makes one Drive
   call. Success → the grant is approved; `unauthorized_client` → still
   pending, with the missing scopes reported. Only runs once admin proof
   has bound the org's domain. `POST .../delegation/approve` no longer takes
   anyone's word — it runs the same check.

**Impersonation is hard-scoped per organization in code** (see
`app/google/drive_client.py::_domain_delegated_client`) — a request tied to
one organization can only impersonate a user whose email domain matches
that same organization's own approved `DelegationGrant.verified_domain`.
This is enforced at the function boundary, not left to caller discipline.

## 5. Environment variables summary

See `backend/.env.example` for the full list. Set the production values as
Railway project/service variables — `DATABASE_URL` is injected
automatically by Railway's managed Postgres addon; everything else here is
set manually per the steps above.

## 6. Rotating secrets

- **`TOKEN_ENCRYPTION_KEY` (Fernet key)**: rotating it invalidates every
  already-encrypted refresh token in `oauth_credentials`. Plan a
  re-encryption migration (decrypt with the old key, re-encrypt with the
  new one) before rotating in production, not a hard cutover.
- **`GOOGLE_OAUTH_CLIENT_SECRET`**: rotate via the GCP Console; update the
  Railway env var; no data migration needed, but it invalidates in-flight
  authorization codes (users mid-login will need to retry).
- **Service account key**: rotate by creating a new key, updating
  `GOOGLE_SERVICE_ACCOUNT_JSON`, then deleting the old key in the GCP
  Console. Delegation is tied to the service account's client ID, not the
  key itself, so key rotation does not require the Workspace super-admin
  to re-approve anything in their Admin console.
