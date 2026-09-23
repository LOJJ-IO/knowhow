import type { AppIconName } from "@/components/app/icon";

/** One icon per route — a Material Symbol, or a codicon where Material's
 *  glyph was wrong for it (`/home`, `/workspace`, `/ownership`, `/sharing`, `/offboarding`, `/help`, user 2026-09-22). `AppIcon` resolves
 *  either set by name, so callers here need not care which. Kept out of
 *  `app-nav.ts` so that config stays free of component imports. Deliberately
 *  not a client module: server screens look their icon up here too, and a
 *  `"use client"` boundary
 *  turns these into references a Server Component can't index into. */
export const NAV_ICONS: Record<string, AppIconName> = {
  "/home": "home",
  "/workspace": "folder",
  "/ownership": "shield",
  "/sharing": "link",
  "/offboarding": "user",
  "/search": "search",
  "/help": "circle-help",
};
