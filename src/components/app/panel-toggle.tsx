"use client";

import { AppIcon } from "@/components/app/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Show or hide the sidebar — Sage_v1's control, rebuilt on Knohow's tokens
 *  and Material Symbols (CLAUDE.md invariant 5: no Sage code or tokens).
 *
 *  White pill around a round icon button; the glyph flips with state
 *  (`left_panel_close` while open, `left_panel_open` while closed), matching
 *  Sage's `layout-sidebar-left-off` / `layout-sidebar-left`. Tooltip carries
 *  the word. Needs a `TooltipProvider` above it; `Topbar` supplies one. */
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
          <AppIcon
            name={open ? "left_panel_close" : "left_panel_open"}
            size={20}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
