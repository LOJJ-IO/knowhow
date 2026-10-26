---
type: feature
status: in-progress
tags: [area/frontend, area/landing]
created: 2026-10-25
updated: 2026-10-25
related: ["[[FEAT-landing-login-panel]]", "[[FEAT-landing-book-a-demo]]", "[[0001-mocked-data-first-prototype]]", "[[Current-Context]]"]
---

# FEAT: Customer survey (`/survey`)

## Status
`in-progress`: built by Tolu with Claude, 2026-10-25. Local, uncommitted, not deployed. Not yet hooked to a sheet (env vars unset).

## Problem
The team is emailing ~120 administrators at African and Caribbean non-profits (associations, advocacy groups and more) to ask whether they'd use Knohow and pay $1,800 a year. Target is 30 responses; if there are fewer by Sun Nov 1, follow-ups go out and the deadline moves to Sun Nov 8. The brief asked for the questions to go into Fillout. Tolu asked for a page on knohow.app instead, fully in Knohow's own look, with a short interactive look at the product before the questions.

## Solution
`knohow.app/survey` (not an app path in `proxy.ts`, so it's served on the landing's origin; `noindex`).

1. **Intro**: the logo lockup, one line, then "Show me".
2. **Tour (about 20s)**: four scenes played like stories (a bar for each, advancing on their own; tap a bar to jump, tap the stage to replay). **Sort**: loose files fly into Finance / Events / Outreach folders (the app's `Folder`). **Share**: a sharing rule, then team members' orbs pop in. **Ownership**: personal-Gmail owners flip to the Treasurer. **Offboard**: one button, a 23→0 file count, three checks. The org (Helping Hands), people and files are made up for the demo. The titles and subtitles are the brief's "What does Knohow do?" lines.
3. **The brief's ten questions**, one per card. A single-choice answer moves on by itself (number keys work too). Q6 lists the four features again with Yes / Maybe / No. Branches: Yes → Q7 ($1,800?) → if No, a price slider ($0–$2,500, notch sounds, presets); Maybe → Q7, then "What's holding you back?"; No → "Why wouldn't you use it?". Q8 and Q10 are optional ("Skip" until something is typed). Q9 is multi-select pills plus Other.
4. **"Who should we thank?"**: name, organization and email, all optional. Then a thank-you screen with the email draft's closing line.

Look: the sign-in sky sheet and `LoginModal` card (height tweens between screens), the setup shell's heading, choices and action. **Back is a pill on the sheet, top-left, not in the card** (Tolu: in the card it looked awkward), with "6 of 10" beside it; a sound toggle sits top-right. Sounds are Web Audio: the landing's original Get Started click (removed from the landing 2026-09-16, see [[Lessons-Learned]]) on every pick, a soft pop for tour beats, and a two-note chime on send. They're on by default, can be muted, and the mute choice is remembered.

## Tracking unique entries
- **`?ref=`** on each person's link (e.g. `knohow.app/survey?ref=row-17`, matching the outreach list) is stored in the `ref` column. That shows who answered without needing their email, so follow-ups go only to people who haven't.
- **`response_id`**: one per browser, made on first send. The Apps Script updates that row on a resend instead of adding a duplicate.
- **Progress is saved in the browser** (`knohow_survey_v1` in localStorage). A refresh resumes where they stopped, and a finished browser shows the thank-you screen rather than allowing a second submission.
- The optional email is a fallback. Nothing stops one person answering from two browsers.

## Out of scope
No backend table and no admin view of responses: the Google Sheet is the record. No Microsoft-specific tour content.

## Technical approach
- `src/app/survey/page.tsx` → `src/components/survey/survey-flow.tsx` (steps, branching, saved progress through a `useSyncExternalStore` store, so there's no setState in an effect) and `survey-tour.tsx` (scenes); `sounds.ts`.
- Answers are sent by the Server Action `src/app/survey/actions.ts`. Only the columns in `src/lib/survey.ts` (`SURVEY_FIELDS`) go through, trimmed to 4,000 chars, and they're POSTed to **`SURVEY_WEBHOOK_URL`** with **`SURVEY_WEBHOOK_SECRET`**. If the URL is unset in dev the response is logged; unset in production the send fails and the card says so (answers stay saved in the browser).
- The webhook is the Apps Script in `docs/business/survey-sheet-webhook.gs` (setup steps are in its header). It writes the header row from the keys, adds columns as fields are added, and upserts on `response_id`.
- Shared changes: `SignInSheet` gained `topRight` (replaces Close) and `onClose` became optional. `globals.css` has `.t-survey` / `.t-survey-wide` card widths, the `.t-survey-range` slider, and a phone rule that moves the card 32px down and hides the Edmonton mark.
- Invariant 2 (no real Google calls from `src/`) is about Workspace integration. This is a generic webhook URL from env, pointed at the team's own sheet. Flagged to Tolu; worth confirming with Ronald.

## Checked
In Chrome on localhost at desktop width and in a 375×667 and 390×780 frame: the tour scenes, keyboard picks, the Yes path skipping Q8, the price slider, tools + Other, the bad-email shake, the send, and the logged row (`ref` and `response_id` present). Lint and `tsc` are clean. Not tested against a real Apps Script deployment yet.

## Open questions
- Does showing the tour before Q3–Q5 bias the problem answers? The brief puts the solution at Q6. One option is to move the tour to Q6.
- Who sets up the sheet and the Vercel env vars before the Nov 1 send?
