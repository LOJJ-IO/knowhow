import type { ReactNode } from "react";

/** The shell every app screen composes, so a new screen never invents its own
 *  page padding.
 *
 *  The screen's name is not here: it lives in `Topbar`, the way Elera puts it
 *  in the row above the content (user 2026-09-21). A screen is its body. */
export function AppPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 pb-6">{children}</main>
  );
}
