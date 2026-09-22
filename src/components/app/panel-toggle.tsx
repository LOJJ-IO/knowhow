"use client";

import { AppIcon } from "@/components/app/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Show or hide the sidebar.
 *
 *  Sage_v1's behaviour for the same control (user 2026-09-21) — a round icon
 *  button with a tooltip carrying the word — but the reference's plain panel
 *  glyph rather than Sage's arrowed one, and without Sage's white pill
 *  (hairline, shadow), both dropped at the user's request the same day. So:
 *  one bare panel icon sitting directly on the page, and the tooltip is what
 *  says which way it goes. Rebuilt on Knohow's own tokens and Google's
 *  Material Symbols; no Sage code, icon set or tokens crossed over (CLAUDE.md
 *  invariant 5).
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
          <AppIcon name="view_sidebar" size={20} />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
