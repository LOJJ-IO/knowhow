"use client";

import { useState } from "react";

import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

/** Holds the one piece of state the chrome owns: whether the sidebar is
 *  showing. The toggle lives in `Topbar` rather than in the sidebar's own row
 *  so it stays reachable once the sidebar is gone. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--app-ground)]">
      {sidebarOpen ? <Sidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
