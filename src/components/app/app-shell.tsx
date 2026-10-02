"use client";

import { useEffect, useRef, useState } from "react";

import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

/** The app's chrome, and the one piece of state it owns.
 *
 *  **The sidebar has two widths and no drag** (user 2026-09-22, replacing the
 *  resizable column): open it is `SIDEBAR_W`, collapsed it is `RAIL_W` — a
 *  column of icons, not an absence. A resize handle was here and is gone; a
 *  width nobody asked to choose is a preference to maintain, a hit area at the
 *  screen edge to avoid, and a number to persist.
 *
 *  Collapsing is done by the **grid track**, not by `display: none` on the
 *  panel: the column goes to `RAIL_W` and the centre's `minmax(0, 1fr)` takes
 *  the rest. */

/** Open. 208px is the 13rem the old `--app-sidebar-w` token settled on. */
const SIDEBAR_W = 208;
/** Collapsed. 64px: a 48px row with an 8px gutter either side. */
const RAIL_W = 64;
/** How long an expansion stays open before collapsing again. */
const PEEK_MS = 4000;

export function AppShell({ children }: { children: React.ReactNode }) {
  // Collapsed by default (user 2026-09-27). The topbar toggle opens and
  // closes it for good. Clicking a nav option in the open sidebar collapses
  // it 4s later.
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  };

  const collapseSoon = () => {
    cancelCollapse();
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null;
      setSidebarVisible(false);
    }, PEEK_MS);
  };

  const onSidebarClick = (event: React.MouseEvent) => {
    // Clicking the rail no longer expands it (user 2026-09-29); only the
    // topbar toggle does.
    const option = (event.target as Element).closest("a[href]");
    if (sidebarVisible && option) collapseSoon();
  };

  useEffect(() => cancelCollapse, []);

  return (
    <div
      className="grid h-dvh overflow-hidden bg-[var(--app-ground)]"
      style={{
        gridTemplateColumns: `${sidebarVisible ? SIDEBAR_W : RAIL_W}px minmax(0, 1fr)`,
        transition: "grid-template-columns 180ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="min-w-0 overflow-hidden" onClick={onSidebarClick}>
        <Sidebar collapsed={!sidebarVisible} />
      </div>

      <div className="flex min-w-0 flex-col">
        <Topbar
          sidebarOpen={sidebarVisible}
          onToggleSidebar={() => {
            cancelCollapse();
            setSidebarVisible((visible) => !visible);
          }}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
