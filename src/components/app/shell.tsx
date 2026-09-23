import type { ReactNode } from "react";

/** The shell every app screen composes, so a new screen never invents its own
 *  page padding.
 *
 *  The screen's name is not here: it lives in `Topbar`, the way Elera puts it
 *  in the row above the content (user 2026-09-21). A screen is its body. */
export function AppPage({ children }: { children: ReactNode }) {
  return (
    // **No left gutter** (user 2026-09-22). The sidebar already ends with a
    // 12px gutter of its own — the space to the right of a row's pill — so
    // any padding here is added to that, and the window sat further from the
    // rows than the rows sit from the sidebar's left edge. With this at zero
    // the window is 12px from the pills, which is exactly the gutter on the
    // other side of them, and the nav reads as evenly inset on both sides.
    // The right gutter matches that 12px so the page isn't lopsided.
    <main className="flex min-h-0 flex-1 flex-col pr-3 pb-6 pl-0">
      {children}
    </main>
  );
}
