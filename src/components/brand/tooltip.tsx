"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Compact black tooltip, for labelling things that can't carry their own
 *  text — the account picker's badges, where the email lives behind a hover.
 *
 *  Deliberately black in both themes rather than themed: it's an overlay, not
 *  a surface, and it has to read against the sheet, the sky and the page.
 *
 *  Written for this repo (Knohow is independent of Sage_v1 — CLAUDE.md
 *  invariant 5); the portal architecture is the standard one, and it is the
 *  point of the component: the badges sit inside the Log In modal, whose
 *  measured height and rounded surface clip a nested absolute span, and the
 *  sheet above the landing is its own stacking context, so no z-index on a
 *  child can lift a tooltip out of it. Portalling to document.body is what
 *  makes it survive, not the styling. */

function TooltipProvider({
  delay = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger(
  props: ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align,
  alignOffset,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Popup> &
  Pick<
    ComponentProps<typeof TooltipPrimitive.Positioner>,
    "side" | "sideOffset" | "align" | "alignOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Above the Log In sheet (z-[400] in landing-hero) and above the
        // app's dialogs (500) and menus (450) — a tooltip labels whatever is
        // in front. The portal escapes the sheet's clipping, but both end up
        // as siblings on <body>, so the tooltip still has to out-rank it:
        // portalling alone is not enough when the thing it must clear is also
        // a root layer.
        className="isolate z-[600]"
      >
        <TooltipPrimitive.Popup
          className={cn(
            "max-w-xs break-words rounded-md bg-black px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-white shadow-md",
            "origin-(--transform-origin) transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="size-2 rotate-45 rounded-[1px] bg-black data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1 data-[side=top]:-bottom-1" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
