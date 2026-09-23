"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { Button } from "@/components/app/button";
import { AppIcon } from "@/components/app/icon";
import { PanelToggle } from "@/components/app/panel-toggle";
import { ProfileMenu } from "@/components/app/profile-menu";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";
import { APP_HOME, APP_NAV, APP_SEARCH, APP_UTILITY } from "@/lib/app-nav";
import { firstName, pickGreeting } from "@/lib/greeting";
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
  // The clock and the pick live in the browser, so the title only becomes the
  // greeting after hydration — rendering it on the server would greet everyone
  // in the server's timezone and then swap the heading under them.
  const hydrated = useHydrated();
  const name = firstName(chrome.viewer.name);
  const greeting = useMemo(
    () => (hydrated ? pickGreeting(name) : ""),
    [hydrated, name],
  );
  const title =
    pathname === APP_HOME && hydrated ? greeting : (current?.label ?? "");

  return (
    <TooltipProvider delay={0}>
      {/* px-2 to line the toggle up with the page gutter below it. */}
      <header className="flex h-16 shrink-0 items-center gap-5 px-2">
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
            className={`${satoshi.className} flex h-10 w-[15rem] items-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 text-[0.9375rem] text-[var(--app-dim)] transition-[border-color,translate] duration-150 hover:border-[#d9d9de] active:translate-y-px`}
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
              <AppIcon name="bell" size={22} />
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
              pill (user 2026-09-22's reference). Clicking it opens the profile
              menu, which is where Settings lives now. */}
          <ProfileMenu>
            <button
              type="button"
              aria-label="Account"
              className={`${satoshi.className} flex h-12 cursor-pointer items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 text-[0.9375rem] font-medium text-[#1c1917] transition-[translate] duration-150 active:translate-y-px`}
            >
              <PersonAvatar
                identity={chrome.viewer.email}
                label={chrome.viewer.name}
                size={36}
              />
              <span className="truncate">{name}</span>
            </button>
          </ProfileMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
