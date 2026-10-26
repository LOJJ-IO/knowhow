"use server";

import { SURVEY_FIELDS, type SurveyResponse } from "@/lib/survey";

/** Longest answer kept, per field. The long answers are a paragraph or two. */
const MAX_ANSWER = 4000;

/** Forwards one survey response to `SURVEY_WEBHOOK_URL` (a Google Apps
 *  Script web app that appends a row to the team's sheet; see
 *  `docs/business/survey-sheet-webhook.gs`). Anyone can POST to a Server
 *  Action, so only the known fields go through, trimmed, and the webhook
 *  checks `SURVEY_WEBHOOK_SECRET`.
 *
 *  Unset locally, the response is logged instead. Unset in production it
 *  fails, so the page says so rather than dropping the answer. */
export async function submitSurvey(
  response: SurveyResponse,
): Promise<{ ok: boolean }> {
  const row: Record<string, string> = {
    submitted_at: new Date().toISOString(),
  };
  for (const key of SURVEY_FIELDS) {
    const value = response?.[key];
    if (typeof value === "string" && value.trim())
      row[key] = value.trim().slice(0, MAX_ANSWER);
  }

  const url = process.env.SURVEY_WEBHOOK_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      console.error("[survey] SURVEY_WEBHOOK_URL is not set; response not saved");
      return { ok: false };
    }
    console.info("[survey] SURVEY_WEBHOOK_URL is not set; response:", row);
    return { ok: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.SURVEY_WEBHOOK_SECRET, row }),
      cache: "no-store",
    });
    // Apps Script answers 200 even when it refuses, so its own `ok` counts.
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ok === false) {
      console.error(`[survey] webhook answered ${res.status}`, body);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[survey] webhook failed", err);
    return { ok: false };
  }
}
