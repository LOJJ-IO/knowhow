---
type: feature
status: in-progress
tags: [area/frontend, legal, privacy]
created: 2026-09-17
updated: 2026-09-17
related: ["[[FEAT-drive-file-classification]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-landing-login-panel]]", "[[Known-Issues]]", "[[Current-Context]]"]
---

# FEAT: Terms of Use + Privacy Policy pages

## Status
`in-progress` — both pages live in the Next.js app 2026-09-17 (`/terms`, `/privacy`, static). **Not reviewed by a lawyer** — the user chose no on-page draft banner. **Launch-blocking mismatch:** the Privacy Policy states the *agreed* privacy model, which the backend doesn't implement yet — see [[Known-Issues]] `[legal / privacy]`.

## Problem
The footer and the Log In modal linked to "Terms of Use" / "Privacy Policy" stubs. User: "Based on the project's specs create a terms of use and privacy policy page. Use canva.com/policies/terms-of-use as a style reference." For pricing and "other stuff", the user pointed at lance.live/terms-and-conditions.

## Solution
**Facts from the user (question tool, 2026-09-17):** operator **LOJJ.IO**; governing law **Alberta, Canada**; contact **info@lojj.io**; pricing **sales-led** (order form / talk to sales); age **18+**; Privacy Policy names provider **categories only** (hosting, database, email, Google APIs) — no vendor names; routes `/terms` + `/privacy`, Canva-like with sidebar; **no draft banner**.

**Layout (Canva reference, screenshotted with Playwright — canva.com returns 403 to plain fetches):** `src/components/legal/legal-page.tsx` — logo lockup header (links home), rounded grey title banner — "by LOJJ.io" line pulled closer to the wordmark, ~10% three times (2026-09-17, user: "shrink the gap… by 10%", then "again" ×2; `LogoLockup` `byTop` prop, `0.60em` default → `0.54em` here; measured ink gap 14.5 → 13.5 → 12.5 → **11.5px** — text snaps to whole px; landing unchanged) (breadcrumb removed 2026-09-17, user: "remove this"; banner keeps its `mt-6`, so it now sits ~12px under the "by LOJJ.io" line) (`#efedea`, Söhne h1), effective-date line, text column (≤55rem) + "Other policies" sidebar (current page bold), numbered Söhne section headings, bold lettered clauses ("A. …"), bullet lists, and light-blue plain-language callouts with an info icon (`#dfe9fd`, Canva's pattern). Body Satoshi 16/26 `#1c1917`. Inline links use the footer-link style (bold + underline).

**Content sources:**
- **Terms (18 sections):** Canva's section order adapted; product facts from [[FEAT-workspace-onboarding-flow]] (identity ≠ membership ≠ ownership ≠ Super Admin; Google proves admin, Knohow never grants it; Google forbids consumer↔Workspace ownership transfer), [[FEAT-drive-file-classification]] (Company/Personal/External, propose → confirm, Shared Drive exception, suggestions ≠ authority, rules → models → AI last, no training without consent). From lance.live, adapted: liability cap = greater of 12 months' fees or **CAD $100**, **30-day informal resolution** before proceedings (courts of Alberta at Edmonton instead of JAMS; **no class-action waiver** — questionable in Canada), changes-with-notice, termination, general provisions, contact. Billing: fees/terms per order form; non-refundable unless the agreement says otherwise.
- **Privacy (15 sections):** data collected mirrors `backend/` (Google sign-in profile + `hd`; org/teams/roles; Drive metadata only, never contents; encrypted OAuth tokens — `app/security/crypto.py`; tamper-evident audit log; demo-form fields; sign-in cookies). Section 3 states constraints 2, 3, 4 and 7 of [[FEAT-drive-file-classification]] as promises. Section 6 is Google's required **Limited Use** disclosure (API Services User Data Policy) + no generalized-AI training on Google data + revoke at myaccount.google.com/permissions — needed for OAuth verification of the restricted `drive` scope. Rights under PIPEDA + Alberta PIPA, complaints to OPC / Alberta OIPC; storage may be outside Canada.

**Wiring:** `FooterStubLink` takes an optional `href` → `next/link`; Terms/Privacy in both landing footers and the Log In modal's terms line now navigate. About Us stays a button stub. Shared `src/components/brand/fonts.ts` (Satoshi, LOJJ face) and `logo-lockup.tsx` (`as="div"` so legal pages keep a single h1) were extracted from `landing-hero.tsx`.

Verified 2026-09-17: both routes 200 at 1440 and 390 wide, no horizontal overflow, one h1 each, 18 / 15 sections; footer → /terms, sidebar → /privacy, logo → /; no console errors; `next build` passes with both prerendered static.

## Out of scope
- Legal review, cookie banner (only sign-in cookies are described), About Us page, policy archive/versions.

## Open questions
- **Lawyer review** before launch, especially: liability cap, indemnity scope, dispute clause, and whether LOJJ.IO is the exact registered legal name.
- Audit-log retention period (policy says "as long as needed"); retention period for unreviewed undecided entries (spec says "set period", length TBD).
- Whether to name sub-processors once Vercel/Railway/Postgres are provisioned (Google's verification may ask).
- Controller vs processor wording for organization data.

## Related
[[FEAT-drive-file-classification]] · [[FEAT-workspace-onboarding-flow]] · [[FEAT-landing-login-panel]] · [[FEAT-landing-book-a-demo]]
