import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { AppSessionProvider } from "@/components/app/session";

export const metadata: Metadata = {
  title: "Knohow",
};

/** The signed-in app: one sidebar, one top row, one content column. Sidebar
 *  and content share the page's background with no divider (Elera's shape).
 *
 *  The session is fetched once, in `AppSessionProvider`, and read from context
 *  by the chrome and by every screen — the org is never re-fetched per screen,
 *  and there is no mock left in this path. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <AppShell>{children}</AppShell>
    </AppSessionProvider>
  );
}
