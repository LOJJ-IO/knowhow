"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { Button } from "@/components/app/button";
import { AppIcon } from "@/components/app/icon";
import { PanelToggle } from "@/components/app/panel-toggle";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";
import { APP_HOME, APP_NAV, APP_SEARCH, APP_UTILITY } from "@/lib/app-nav";
import { useHydrated } from "@/lib/use-hydrated";

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
  // Home greets the person instead of naming the screen (user 2026-09-22).
  // The time of day is the browser's, so the title only becomes the greeting
  // after hydration — rendering it on the server would greet everyone in the
  // server's timezone and then swap the heading under them.
  const hydrated = useHydrated();
  const title =
    pathname === APP_HOME && hydrated
      ? `Good ${partOfDay()}, ${firstName(chrome.viewer.name)}`
      : (current?.label ?? "");

  return (
    <TooltipProvider delay={0}>
      <header className="flex h-16 shrink-0 items-center gap-5 px-5">
        <PanelToggle open={sidebarOpen} onToggle={onToggleSidebar} />
        <h1
          className={`${sohne.className} m-0 min-w-0 truncate text-[1.5rem] leading-[1.3] tracking-tight text-[#1c1917]`}
        >
          {title}
        </h1>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Link
            href={APP_SEARCH.href}
            aria-current={pathname === APP_SEARCH.href ? "page" : undefined}
            className={`${satoshi.className} flex h-10 w-[15rem] items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 text-[0.9375rem] text-[var(--app-dim)] transition-[border-color,transform] duration-150 hover:border-[#d9d9de] active:scale-[0.98]`}
          >
            <span className="truncate">Search</span>
            <kbd className="ml-auto shrink-0 font-sans text-[0.8125rem] text-[var(--app-dim)]">
              ⌘K
            </kbd>
          </Link>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Notifications"
                />
              }
            >
              <AppIcon name="notifications" size={20} />
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Notifications
            </TooltipContent>
          </Tooltip>

          <Button className="pr-4 pl-3">
            <AppIcon name="add" size={19} />
            New
          </Button>

          {/* The person, as a chip: their orb and their first name on a white
              pill (user 2026-09-22's reference). Not a control yet — there is
              nothing behind it to open. */}
          <div
            className={`${satoshi.className} flex h-12 items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 text-[0.9375rem] font-medium text-[#1c1917]`}
          >
            <PersonAvatar
              identity={chrome.viewer.email}
              label={chrome.viewer.name}
              size={36}
            />
            <span className="truncate">{firstName(chrome.viewer.name)}</span>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

/** Morning until noon, afternoon until 6, evening after that. The plain
 *  reading of the clock, not sunrise maths. */
function partOfDay(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** What people call each other. Falls back to the whole string, which is what
 *  an address or a one-word name already is. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
