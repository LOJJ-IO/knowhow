---
type: plan
status: active
tags: [priority/high, area/frontend, area/backend, area/deploy]
created: 2026-09-26
updated: 2026-09-26
related: ["[[Current-Context]]", "[[FEAT-core-app-screens]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-drive-file-classification]]", "[[Known-Issues]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[0008-continue-with-google-via-backend]]"]
---

# Plan: BCW proposal-ready (Claude Code handoff)

**Audience:** Claude Code / any agent implementing toward a pilot that matches `docs/business/Knohow Business Proposal for BCW.pdf` (2026-09-08).  
**Definition of done:** A non-engineering stakeholder on a real Workspace can walk the seven landing-deck features with live Drive data (or an explicitly scoped “test-user pilot” variant — call that out if chosen).  
**Authoritative memory:** Prefer this note + linked vault notes over chat. Update [[Current-Context]] when a phase completes.

**Landing deck features (must map to product):** Unified Workspace · Auto-Own · Auto-Share · Oversight · DeepSearch · Org-Chart & Permissions · Instant Offboard — see [[FEAT-landing-deck-carousel]], [[FEAT-core-app-screens]].

**Already true (do not re-build as blockers):** ADR-0021 onboarding on `main` (founder ≠ owner, join wizard, lead approvals); admin proof; `DelegationConnectStep` UI after SA verify (2026-09-26); Home org chart; privacy FileIndex rules for unconfirmed files. See [[Current-Context]].

---

## Why these six blockers (evidence)

### 1. Feature UIs missing for six of seven deck promises

**Claim:** Pilots cannot *use* most proposal features in the app.

**Justification:**
- [[FEAT-core-app-screens]]: “the 7 screens are empty states awaiting design”; only Home/org chart is real.
- App routes that only render `EmptyScreen`: `src/app/(app)/workspace/page.tsx`, `ownership/page.tsx`, `sharing/page.tsx`, `search/page.tsx`, `offboarding/page.tsx`, `help/page.tsx`.
- Backend engines exist under `backend/app/` (sharing, search/deepsearch, offboarding, activity) but [[0016-app-reads-the-backend-not-fixtures]] + Current-Context: frontend does not surface them.
- Proposal gap note in [[Current-Context]] (2026-09-25): “Only the org chart and onboarding have frontend.”

**Without this:** Even perfect Drive auth looks like an empty product.

---

### 2. Domain-wide delegation not finished / proven on a real Workspace

**Claim:** Company-wide Drive access requires Admin console authorization of the service account; that path is incomplete until status is `approved`.

**Justification:**
- Spec: [[FEAT-workspace-onboarding-flow]] — admin proof ≠ delegation proof; Workspace-wide column waits on impersonated calls succeeding.
- Backend: `initiate_delegation` / `check_delegation` / `GET …/delegation/setup` in `backend/app/auth/delegation.py`, routes in `backend/app/api/routes/delegation.py`. Drive clients refuse unapproved grants (`backend/app/google/drive_client.py`).
- Frontend guide exists (`src/components/setup/delegation-connect-step.tsx`) but Current-Context / Known-Issues: end-to-end Admin console check **untested** against a real Workspace; SA key path configured locally only.
- ADR-0004 / [[0008-continue-with-google-via-backend]]: GCP project exists; domain-wide delegation authorization in a customer Workspace is separate.

**Without this:** Org chart works; Auto-Own / Auto-Share / activity / org-wide DeepSearch as designed do not.

---

### 3. File classification / confirmation not built

**Claim:** Company files created outside Knohow never enter the searchable/manageable index until classification ships — by design.

**Justification:**
- Locked constraints in [[FEAT-drive-file-classification]] / ADR-0005: `¬Confirmed(Company) → ¬InFileIndex`.
- Implemented 2026-09-25: unconfirmed detections do not write `FileIndex` (migration `0017`, [[Known-Issues]] Recently resolved). Consequence documented in [[Current-Context]]: until classification UI/flow exists, outside-Knohow files never reach `/files`, dashboards, or others’ DeepSearch.
- DeepSearch historically could leak unindexed titles; privacy fix narrowed that — but empty index remains for “real company Drive” demos.

**Without this:** Connected Drive still looks empty for the features that need an org file corpus.

---

### 4. No durable hosted backend for pilots

**Claim:** There is no shared production API + Postgres for BCW to use; local uvicorn is not a pilot environment.

**Justification:**
- [[0004-fastapi-backend-for-auth-and-identity]]: Railway + Postgres intended; **not provisioned**.
- [[Architecture-Overview]] “Backend integration contract”: undeployed; `NEXT_PUBLIC_BACKEND_API_URL` still local-oriented.
- [[Current-Context]]: “Still not deployed… no Railway/Postgres instance.”
- Frontend on Vercel (landing) ≠ FastAPI+Drive backend availability for multi-user sessions.

**Without this:** Demo stays on one laptop; cookies, OAuth redirect URIs, and uptime don’t match a client pilot.

---

### 5. Google OAuth verification / Testing-mode gate

**Claim:** Non–test-user accounts cannot complete restricted Drive consent; even sign-in is limited while the app is in Testing.

**Justification:**
- [[Known-Issues]] `[google / OAuth verification — launch-blocking]`: `drive` + `admin.reports.audit.readonly` are **restricted**; verification **not submitted** (as of 2026-09-18); Testing mode → test-user list only.
- `backend/docs/gcp-setup.md` + ADR-0004 scope notes: full `drive` required for ownership/permission work; narrower scopes insufficient.
- Domain-wide delegation bypasses *per-user* Drive consent for Workspace members once approved — but personal-OAuth paths and unverified sign-in still hit Testing limits; external pilots still need verification or per-person test-user adds.

**Without this:** “Add everyone as a GCP test user” is the only pilot path (explicitly noted in Current-Context proposal gap).

---

### 6. Secondary credibility / legal / security-copy gaps

**Claim:** Even if features work, proposal/privacy claims and unfinished product slices can block a serious pilot or verification.

**Justification:**
- Proposal claims AES-256 at rest; tokens use Fernet (AES-128) — Current-Context proposal gap; `backend/app/security/crypto.py`.
- [[FEAT-legal-pages]] / Known-Issues: Privacy Policy states the agreed model; launch risk if product/backend diverge.
- Contractors ([[0009]]), Projects, Shared Drive gaps ([[Known-Issues]] ownership invariant) if the pitch includes them.
- OAuth verification often asks for privacy policy, Limited Use, and hosted demos — legal + deploy couple to blocker 5.

**Without this:** Engineering can demo; sales/legal/Google review can still fail.

---

## Recommended order (dependency graph)

```text
5 (start OAuth verification prep) ──┐
4 (Railway + Postgres + URLs) ──────┼──► 2 (complete + prove delegation on pilot Workspace)
                                    │
3 (classification) ◄── needs 2 for live Drive discovery
                                    │
1 (feature UIs) ◄── needs 2+3 for non-empty data; can scaffold UI against mocks earlier
                                    │
6 (copy/legal/crypto honesty) ──────┴──► continuous; harden before external pilot
```

**Parallelizable:** Start (4) and (5) paperwork immediately. Scaffold (1) UI against backend contracts while (2)/(3) unstick data. Do not claim “proposal ready” until (1)+(2)+(3) pass exit criteria below; (4)+(5) required for *external* BCW users; (6) required before sending the PDF claims as-is.

---

## Phase A — Hosted backend (blocker 4)

**Goal:** Stable `https://api…` + Postgres with migrations, env secrets, CORS/cookies for the frontend origin.

**Work:**
1. Provision Railway (or chosen host) + Postgres; set `DATABASE_URL`, JWT/Fernet keys, Google OAuth client, service-account JSON path/secret, `FRONTEND_ORIGIN`, cookie settings per Architecture-Overview.
2. Run Alembic to head (include `0017`, `0018`, …).
3. Point production/preview Next.js `NEXT_PUBLIC_BACKEND_API_URL` at that API; register OAuth redirect URIs.
4. Smoke: signup → `/auth/me` → org setup on hosted stack.

**Exit:** Two browsers on different machines can sign into the same org against hosted API.

**Evidence to update:** Current-Context “Still not deployed”; Known-Issues deploy/data.

---

## Phase B — OAuth verification track (blocker 5)

**Goal:** Path for non–test-user Workspace users (or an explicitly accepted long-lived test-user pilot).

**Work:**
1. Decide: **narrow pilot** (test users only) vs **submit verification**.
2. If submit: consent screen, Limited Use, privacy URL, demo video/security questionnaire per Google; track in Known-Issues.
3. Keep adding BCW participants as test users until verified.
4. Rotate OAuth client secret if still exposed (Current-Context Windows note).

**Exit:** Documented decision + either verification submitted (with ID) or named test-user pilot SOP.

---

## Phase C — Prove delegation (blocker 2)

**Goal:** `POST /organizations/{id}/delegation/check` → `status: approved` on the pilot Workspace.

**Work:**
1. SA completes `DelegationConnectStep` (client ID + `scopes_csv` into Admin → Domain-wide delegation).
2. Fix any missing-scopes / API-not-enabled / key issues from check errors.
3. Verify one delegated Drive call (e.g. activity or `drive_client` for a member).
4. Record in Current-Context: domain, date, approved.

**Exit:** Automated or manual check shows `approved`; one Drive list/metadata call succeeds as org.

**Depends on:** Phase A for multi-user; can be done locally first for engineering confidence.

---

## Phase D — Classification into FileIndex (blocker 3)

**Goal:** Confirmed company files appear in org index; personal stay out; unconfirmed never index (already enforced).

**Work (follow [[FEAT-drive-file-classification]]):**
1. Implement confirmation UX + APIs for suggested/company candidates (ID-only storage until confirm).
2. Wire detection → suggestion → confirm → `FileIndex`.
3. Ensure DeepSearch / workspace list use indexed + visibility rules only.
4. Tests extending `backend/tests/test_file_privacy.py`.

**Exit:** After confirm, file appears for authorized roles; personal/unconfirmed never do.

**Depends on:** Phase C for real detections; UI can be stubbed with fixtures earlier if user allows.

---

## Phase E — Feature UIs (blocker 1)

**Goal:** Each deck feature has a usable screen wired to backend (not EmptyScreen).

| Deck feature | Primary route / surface | Backend seams (start here) |
| --- | --- | --- |
| Org-Chart & Permissions | `/home` (exists) | org overview, teams, memberships |
| Oversight | Home pulses + deepen feed / notifications | activity / audit changes |
| Unified Workspace | `/workspace` | files list, Drive connect CTA already on empty state |
| Auto-Own | `/ownership` | ownership / transfer APIs |
| Auto-Share | `/sharing` | sharing service / suggested shares |
| DeepSearch | `/search` | `backend/app/search/deepsearch.py` |
| Instant Offboard | `/offboarding` | `backend/app/offboarding/` |

**Work rules:**
- User designs copy/layout — do not invent marketing UI ([[CLAUDE.md]] frontend rebuild rule).
- Prefer backend contracts already in Architecture-Overview; no second API layer in Next for mutations beyond Server Actions if that pattern returns.
- Ship vertical slices: one feature screen + happy path + empty/error states.

**Exit:** Stakeholder click-through script covers all seven without hitting EmptyScreen for the happy path.

**Depends on:** Phase C+D for non-empty Drive demos; UI scaffolding can start in parallel with mocks **only if** user explicitly allows mocks (ADR-0001 still binds `src/` Google calls).

---

## Phase F — Credibility & legal (blocker 6)

**Goal:** Proposal/privacy/security claims match the product.

**Work:**
1. Reconcile AES-256 claim vs Fernet (change proposal copy or encryption — product decision).
2. Audit Privacy Policy vs FileIndex/classification/delegation behavior; fix Known-Issues legal blockers.
3. Scope contractor/Shared Drive language out of pilot pitch until [[0009]] / Shared Drive exist.
4. Ensure verification packet matches live privacy URL and Limited Use section.

**Exit:** Sales can send BCW materials without known false claims; legal checklist green for pilot.

---

## Explicit non-goals (for this plan)

- Multi-lead polish, Home redesign beyond what’s needed for Oversight.
- Contractor automation account path ([[0009]]) unless BCW requires it in writing.
- Replacing Vercel with Cloudflare unless decided in a new ADR.
- Inventing deck copy or screen layouts without user design.

---

## Suggested Claude Code session protocol

1. Read this note + [[Current-Context]] + relevant FEAT/Known-Issues before coding.
2. Pick **one phase** (A–F); state exit criteria; implement; run targeted tests.
3. Write back to Current-Context + Known-Issues/FEAT the same turn (second-brain rule).
4. Do not mark “proposal ready” until Phases **C, D, E** exit; for external BCW users also **A, B**; before customer-facing PDF claims also **F**.
5. Prefer evidence (routes, migrations, check status) over narrative.

---

## Traceability checklist (agent self-audit)

- [ ] EmptyScreen routes still listed above? → blocker 1 open  
- [ ] `delegation/check` approved on pilot org? → blocker 2  
- [ ] Outside-Knohow file confirmable into FileIndex? → blocker 3  
- [ ] Hosted API URL in env for non-local clients? → blocker 4  
- [ ] Verification submitted or test-user SOP documented? → blocker 5  
- [ ] AES / privacy / contractor claims reconciled? → blocker 6  
