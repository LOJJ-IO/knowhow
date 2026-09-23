import type { ReactNode } from "react";

/** The shell every app screen composes, so a new screen never invents its own
 *  page padding.
 *
 *  The screen's name is not here: it lives in `Topbar`, the way Elera puts it
 *  in the row above the content (user 2026-09-21). A screen is its body. */
export function AppPage({ children }: { children: ReactNode }) {
  return (
    // px-2: the window sits close to the sidebar's icons (user 2026-09-22).
    // This gutter was 24px and was the whole of the distance between them.
    <main className="flex min-h-0 flex-1 flex-col px-2 pb-6">{children}</main>
  );
}
