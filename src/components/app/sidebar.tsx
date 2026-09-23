"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { satoshi } from "@/components/brand/fonts";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { LogoMark } from "@/components/brand/logo-mark";
import { AppIcon } from "@/components/app/icon";
import { MorphIcon, NAV_MORPH, SettingsIcon } from "@/components/app/nav-morph";
import { NAV_ICONS } from "@/components/app/nav-icons";
import { SettingsDialog } from "@/components/app/settings-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";
import { APP_NAV, APP_SECTIONS, APP_UTILITY } from "@/lib/app-nav";
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
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Which row the pointer is on. Home and Workspace use it for their icons'
   *  hover states; every other row ignores it. */
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <TooltipProvider delay={0}>
      <nav
        aria-label="Knohow"
        className="flex h-full w-full min-w-0 flex-col overflow-hidden"
      >
        {/* The full landing lockup, not the bare hexagon mark (user 2026-09-21),
          then resized at the user's request: 1.6rem → 1.92rem → 2.5rem →
          2.125rem (−15%), and nudged 10px down the row.
          `as="div"` because the screen's name is already this page's <h1>, in
          `Topbar`. The row stays h-16 so it keeps lining up with the page title
          across the way. px-4 gives the lockup a gutter on both sides without
          pushing it out of line with the nav rows below. */}
        <div
          className={cn(
            "flex h-16 items-center pt-[10px]",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          {collapsed ? (
            // The reference's rail puts the mark at ~0.29 of the rail's width
            // (measured 37px of 129px); RAIL_W is 64, so 18px.
            <LogoMark className="h-auto w-[18px]" />
          ) : (
            <LogoLockup fontSize="2.125rem" as="div" />
          )}
        </div>

        {/* Nav brought down 30% at the user's request (2026-09-21): the first
          row used to start 4.5rem from the top (the h-16 brand row plus the
          first section's mt-2), and now starts at 5.85rem. */}
        <div
          className={cn(
            "app-scroll-plain flex-1 overflow-y-auto pt-[1.35rem] pb-2",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {APP_SECTIONS.map((section) => {
            const items = APP_NAV.filter((item) => item.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="mt-6 first:mt-2">
                {collapsed ? null : (
                  <p
                    className={`${satoshi.className} px-4 pb-2 text-[0.8125rem] leading-[1.3] text-[var(--app-dim)]`}
                  >
                    {section}
                  </p>
                )}
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Row
                          collapsed={collapsed}
                          label={item.label}
                          href={item.href}
                          active={active}
                          onHover={setHovered}
                        >
                          {NAV_MORPH[item.href] ? (
                            <MorphIcon
                              href={item.href}
                              open={hovered === item.href}
                            />
                          ) : (
                            <AppIcon name={NAV_ICONS[item.href]} size={22} />
                          )}
                        </Row>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Help and Settings sit under the sections, quieter than a feature
          (user 2026-09-21, Elera's bottom group). Same row shape, muted. */}
        <ul
          className={cn(
            satoshi.className,
            "m-0 flex list-none flex-col gap-1 pb-1",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {APP_UTILITY.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Row
                  collapsed={collapsed}
                  label={item.label}
                  href={item.href}
                  active={active}
                  onHover={setHovered}
                  muted
                >
                  {NAV_MORPH[item.href] ? (
                    <MorphIcon href={item.href} open={hovered === item.href} />
                  ) : (
                    <AppIcon name={NAV_ICONS[item.href]} size={22} />
                  )}
                </Row>
              </li>
            );
          })}
          <li>
            <Row
              collapsed={collapsed}
              label="Settings"
              onClick={() => setSettingsOpen(true)}
              onHover={setHovered}
              hoverKey="settings"
              muted
            >
              <SettingsIcon open={hovered === "settings"} />
            </Row>
          </li>
        </ul>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        {/* Nothing under the utility rows. The person used to sit here with
            their name and organization; all three are gone (user 2026-09-22).
            The topbar's profile chip is where the person is now. */}
      </nav>
    </TooltipProvider>
  );
}

/** A nav row. Expanded it is an icon and a label in a pill; collapsed it is
 *  the icon alone, centred, with the label moved into a tooltip — an unlabelled
 *  icon still has to say what it is (user 2026-09-22's rail). `href` makes it a
 *  link, `onClick` a button; one of the two is always given. */
function Row({
  collapsed,
  label,
  href,
  active = false,
  muted = false,
  onClick,
  onHover,
  hoverKey,
  children,
}: {
  collapsed: boolean;
  label: string;
  href?: string;
  active?: boolean;
  /** Utility rows (Help, Settings) sit quieter than the features above. */
  muted?: boolean;
  onClick?: () => void;
  onHover?: (key: string | null) => void;
  /** What `onHover` reports. Defaults to `href`, so a row without one (the
   *  Settings button) can still drive an icon's hover state. */
  hoverKey?: string;
  children: ReactNode;
}) {
  const className = cn(
    satoshi.className,
    "flex h-[var(--app-row-h)] cursor-pointer items-center rounded-full text-[1.0625rem] transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
    collapsed
      ? "w-[var(--app-row-h)] justify-center px-0"
      : "w-full gap-3 px-4",
    active
      ? "bg-[var(--app-active)] font-medium text-[#1c1917]"
      : cn(
          muted ? "text-[var(--app-dim)]" : "text-[#44403c]",
          "hover:bg-[var(--app-muted)]",
        ),
  );

  const key = hoverKey ?? href ?? null;
  const hover = {
    onMouseEnter: () => onHover?.(key),
    onMouseLeave: () => onHover?.(null),
  };

  const inner = (
    <>
      {children}
      {collapsed ? null : <span className="truncate">{label}</span>}
    </>
  );

  const row = href ? (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={className}
      {...hover}
    >
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={cn(className, "text-left")}
      {...hover}
    >
      {inner}
    </button>
  );

  if (!collapsed) return row;

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
