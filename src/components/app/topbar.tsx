"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppIcon } from "@/components/app/icon";
import { PanelToggle } from "@/components/app/panel-toggle";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TooltipProvider } from "@/components/brand/tooltip";
import { APP_NAV, APP_SEARCH, APP_UTILITY } from "@/lib/app-nav";

/** The row above every screen, laid out off the reference (user 2026-09-21):
 *  panel toggle, the screen's name, then — pushed right — search, alerts, the
 *  New action and the person.
 *
 *  The reference's grid icon between search and the bell was left out at the
 *  user's request.
 *
 *  Two of these are **not wired to anything yet**: alerts (Knohow has no
 *  notifications) and New (nothing to create until documents exist). They are
 *  here because the band was asked for; what they do is still an open
 *  question, recorded in FEAT-core-app-screens. */
export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const { chrome } = useSession();
  const current = [...APP_NAV, APP_SEARCH, ...APP_UTILITY].find(
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

      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <Link
          href={APP_SEARCH.href}
          aria-current={pathname === APP_SEARCH.href ? "page" : undefined}
          className={`${satoshi.className} flex h-10 w-[15rem] items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 text-[0.9375rem] text-[var(--app-dim)] transition-colors hover:border-[#d9d9de]`}
        >
          <span className="truncate">Search</span>
          <kbd className="ml-auto shrink-0 font-sans text-[0.8125rem] text-[var(--app-dim)]">
            ⌘K
          </kbd>
        </Link>

        <button
          type="button"
          aria-label="Alerts"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-[var(--app-muted)] text-[#44403c] transition-colors hover:bg-[var(--app-active)]"
        >
          <AppIcon name="notifications" size={20} />
        </button>

        <button
          type="button"
          className={`${satoshi.className} flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[#1c1917] pr-4 pl-3 text-[0.9375rem] font-medium text-white transition-transform duration-150 active:scale-95`}
        >
          <AppIcon name="add" size={19} />
          New
        </button>

        <PersonAvatar
          identity={chrome.viewer.email}
          label={chrome.viewer.name}
          size={40}
        />
      </div>
    </header>
  );
}
