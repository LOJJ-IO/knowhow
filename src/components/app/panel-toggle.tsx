"use client";

import { AppIcon } from "@/components/app/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Show or hide the sidebar.
 *
 *  Follows the shape Sage_v1 used for the same control (user 2026-09-21): a
 *  pill-shaped group with a hairline and a soft shadow, a round icon button
 *  inside it, the **icon flipping with state** rather than staying put, and a
 *  tooltip carrying the word. Rebuilt on Knohow's own tokens and Google's
 *  Material Symbols — no Sage code, icon set or tokens crossed over
 *  (CLAUDE.md invariant 5).
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
    <div className="inline-flex w-fit shrink-0 items-center rounded-full border border-[var(--app-border)] bg-white p-0.5 shadow-sm">
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
