"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Show or hide the sidebar — Sage_v1's control, rebuilt on Knohow's tokens
 *  (CLAUDE.md invariant 5: no Sage code or tokens).
 *
 *  **The glyph is VS Code's `layout-sidebar-left` pair**, which is what Sage
 *  uses. Material Symbols' nearest equivalent was tried first and was wrong
 *  twice over (user, 2026-09-22): a different shape language, and its two
 *  states differ only by a small arrow inside an identical frame — at 20px
 *  that reads as no swap at all.
 *
 *  The codicon pair differs by a whole filled pane, so the state is legible at
 *  a glance: **split frame** while the sidebar shows (click to collapse),
 *  **right pane filled** while it is hidden (the filled side is where the
 *  content is now, click to bring the sidebar back).
 *
 *  Tooltip carries the word. Needs a `TooltipProvider` above it; `Topbar`
 *  supplies one. */
export function PanelToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const label = open ? "Collapse" : "Expand";
  return (
    // Same control as the topbar's Notifications button (user 2026-09-22):
    // grey disc, 40px, 20px glyph, darkening on hover. The white ringed pill
    // this used to sit in read as a second, competing control.
    <div className="inline-flex w-fit shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-pressed={open}
              onClick={onToggle}
              className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-[var(--app-muted)] text-[#44403c] transition-[background-color,color,transform] duration-150 active:scale-95 hover:bg-[var(--app-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
            />
          }
        >
          <SidebarGlyph showing={open} />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** codicon `layout-sidebar-left-off` (showing) and `layout-sidebar-left`
 *  (hidden), 16×16, from @vscode/codicons — MIT, © Microsoft. Inlined rather
 *  than pulling a second icon font in for one control; a third-party icon set
 *  is not Sage's design system, so invariant 5 is untouched. */
function SidebarGlyph({ showing }: { showing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden>
      {showing ? (
        <path d="M1 3.5V12.5C1 13.879 2.122 15 3.5 15H12.5C13.878 15 15 13.879 15 12.5V3.5C15 2.122 13.878 1 12.5 1H3.5C2.122 1 1 2.122 1 3.5ZM12.5 14H7V2H12.5C13.327 2 14 2.673 14 3.5V12.5C14 13.327 13.327 14 12.5 14ZM2 3.5C2 2.673 2.673 2 3.5 2H6V14H3.5C2.673 14 2 13.327 2 12.5V3.5Z" />
      ) : (
        <path d="M12.5 1C13.881 1 15 2.119 15 3.5V12.5C15 13.881 13.881 15 12.5 15H3.5C2.119 15 1 13.881 1 12.5V3.5C1 2.119 2.119 1 3.5 1H12.5ZM12.5 14C13.328 14 14 13.328 14 12.5V3.5C14 2.672 13.328 2 12.5 2H7V14H12.5Z" />
      )}
    </svg>
  );
}
