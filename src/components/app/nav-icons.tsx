import type { AppIconName } from "@/components/app/icon";

/** One Google Material Symbol per route, kept out of `app-nav.ts` so that
 *  config stays free of component imports. Deliberately not a client module:
 *  server screens look their icon up here too, and a `"use client"` boundary
 *  turns these into references a Server Component can't index into. */
export const NAV_ICONS: Record<string, AppIconName> = {
  "/dashboard": "monitoring",
  "/workspace": "folder_open",
  "/oversight": "visibility",
  "/ownership": "verified_user",
  "/sharing": "share",
  "/org-chart": "account_tree",
  "/offboarding": "person_remove",
  "/search": "search",
  "/help": "help",
};
