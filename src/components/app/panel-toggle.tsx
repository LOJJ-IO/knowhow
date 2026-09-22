"use client";

import { AppIcon } from "@/components/app/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Show or hide the sidebar.
 *
 *  Follows Sage_v1's behaviour for the same control (user 2026-09-21): a round
 *  icon button whose **icon flips with state** rather than staying put, with a
 *  tooltip carrying the word. Sage's white pill around it — hairline, shadow —
 *  was dropped at the user's request the same day, so the icon sits directly on
 *  the page. Rebuilt on Knohow's own tokens and Google's Material Symbols; no
 *  Sage code, icon set or tokens crossed over (CLAUDE.md invariant 5).
 *
 *  The icon shows what the click will do, not what is currently true: panel
 *  closing when it is open, panel opening when it is hidden.
 *
 *  Needs a `TooltipProvider` above it; `Topbar` supplies one. */
export function PanelToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const label = open ? "Collapse" : "Expand";
  return (
    <div className="inline-flex w-fit shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-pressed={open}
              onClick={onToggle}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--app-dim)] transition-colors hover:bg-[var(--app-muted)] hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
            />
          }
        >
          <AppIcon name={open ? "left_panel_close" : "left_panel_open"} size={20} />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
