"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppIcon } from "@/components/app/icon";
import { PanelToggle } from "@/components/app/panel-toggle";
import { TooltipProvider } from "@/components/brand/tooltip";
import { APP_NAV, APP_SEARCH } from "@/lib/app-nav";

/** The row above every screen: the sidebar toggle, which screen you are on,
 *  and the way into search.
 *
 *  Elera's band (user 2026-09-21) reads logo · toggle · page name, evenly
 *  spaced. The toggle sits at the head of this row rather than inside the
 *  sidebar, which puts it exactly between the lockup and the title and keeps
 *  it reachable when the sidebar is hidden. */
export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const current = [...APP_NAV, APP_SEARCH].find(
    (item) => item.href === pathname,
  );

  return (
    <header className="flex h-16 shrink-0 items-center gap-5 px-5">
      <TooltipProvider delay={0}>
        <PanelToggle open={sidebarOpen} onToggle={onToggleSidebar} />
      </TooltipProvider>
      <h1
        className={`${sohne.className} m-0 min-w-0 truncate text-[1.5rem] leading-[1.3] tracking-tight text-[#1c1917]`}
      >
        {current?.label ?? ""}
      </h1>
      <Link
        href={APP_SEARCH.href}
        aria-current={pathname === APP_SEARCH.href ? "page" : undefined}
        className={`${satoshi.className} ml-auto flex h-10 w-[18rem] shrink-0 items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-3.5 text-[0.9375rem] text-[var(--app-dim)] transition-colors hover:border-[#d9d9de]`}
      >
        <AppIcon name="search" size={19} />
        <span className="truncate">Search</span>
        <kbd className="ml-auto shrink-0 rounded-[6px] bg-[var(--app-muted)] px-1.5 py-0.5 font-sans text-[0.75rem] text-[var(--app-dim)]">
          ⌘K
        </kbd>
      </Link>
    </header>
  );
}
