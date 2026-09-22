"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { AppIcon } from "@/components/app/icon";
import { NAV_ICONS } from "@/components/app/nav-icons";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { useSession } from "@/components/app/session";
import { APP_NAV, APP_SECTIONS } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

/** The app's one navigation surface: the org it belongs to, the screens
 *  grouped by what they are about, and who is signed in.
 *
 *  Sized off the X reference and laid out off Elera's (user 2026-09-21): a
 *  wide column, rows tall enough to read as destinations, sentence-case
 *  section labels, and a fully rounded pill on the active row. It shares the
 *  page's background with no divider, the way Elera's does.
 *
 *  Client-side only because it needs the current route; everything it renders
 *  comes in as props or from `APP_NAV`. */
export function Sidebar() {
  const pathname = usePathname();
  const { chrome } = useSession();

  return (
    <nav
      aria-label="Knohow"
      className="flex w-[var(--app-sidebar-w)] shrink-0 flex-col"
    >
      {/* The full landing lockup, not the bare hexagon mark (user 2026-09-21),
          then resized at the user's request: 1.6rem → 1.92rem → 2.5rem →
          2.125rem (−15%), and nudged 10px down the row.
          `as="div"` because the screen's name is already this page's <h1>, in
          `Topbar`. The row stays h-16 so it keeps lining up with the page title
          across the way. px-4 gives the lockup a gutter on both sides without
          pushing it out of line with the nav rows below. */}
      <div className="flex h-16 items-center px-4 pt-[10px]">
        <LogoLockup fontSize="2.125rem" as="div" />
      </div>

      {/* Nav brought down 30% at the user's request (2026-09-21): the first
          row used to start 4.5rem from the top (the h-16 brand row plus the
          first section's mt-2), and now starts at 5.85rem. */}
      <div className="flex-1 overflow-y-auto px-3 pt-[1.35rem] pb-4">
        {APP_SECTIONS.map((section) => {
          const items = APP_NAV.filter((item) => item.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section} className="mt-6 first:mt-2">
              <p
                className={`${satoshi.className} px-3 pb-2 text-[0.8125rem] leading-[1.3] text-[var(--app-dim)]`}
              >
                {section}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          satoshi.className,
                          "flex h-[var(--app-row-h)] items-center gap-3 rounded-full px-3.5 text-[1.0625rem] transition-colors",
                          active
                            ? "bg-[var(--app-active)] font-medium text-[#1c1917]"
                            : "text-[#44403c] hover:bg-[var(--app-muted)]",
                        )}
                      >
                        <AppIcon name={NAV_ICONS[item.href]} size={22} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* The person, with their generated gradient avatar — seeded from their
          address, so it is the same avatar everywhere. The organization's name
          sits under it: the lockup above is the product, this is the tenant. */}
      <div className={`${satoshi.className} flex items-center gap-2.5 px-4 py-4`}>
        <PersonAvatar
          identity={chrome.viewer.email}
          label={chrome.viewer.name}
          size={32}
        />
        <div className="min-w-0">
          <p className="m-0 truncate text-[0.875rem] font-medium text-[#1c1917]">
            {chrome.viewer.name}
          </p>
          <p className="m-0 truncate text-[0.75rem] text-[var(--app-dim)]">
            {chrome.name}
          </p>
        </div>
      </div>
    </nav>
  );
}
