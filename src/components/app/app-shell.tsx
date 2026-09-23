"use client";

import { useState } from "react";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div
      className="grid h-dvh overflow-hidden bg-[var(--app-ground)]"
      style={{
        gridTemplateColumns: `${sidebarVisible ? SIDEBAR_W : RAIL_W}px minmax(0, 1fr)`,
        transition: "grid-template-columns 180ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="min-w-0 overflow-hidden">
        <Sidebar collapsed={!sidebarVisible} />
      </div>

      <div className="flex min-w-0 flex-col">
        <Topbar
          sidebarOpen={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible((visible) => !visible)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
