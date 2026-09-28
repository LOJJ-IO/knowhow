"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Knohow's tooltip, for labelling things that can't carry their own text
 *  (the account picker's badges, the bell, definitions of "owner" and "Super
 *  Admin") and, as `ErrorTip`, for a field's error.
 *
 *  Styled after Safari's form bubble (user 2026-09-27). Dark in both themes
 *  rather than themed: it's an overlay, not a surface, and it has to read
 *  against the sheet, the sky and the page.
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
            // Safari's form bubble, which the user picked as the look for
            // every tooltip (2026-09-27): soft dark grey, rounded corners, a
            // rounded arrow. The shadow is a drop-shadow *filter*, not a
            // box-shadow, so box and arrow cast one outline and read as one
            // shape (a box-shadow and an edge ring left a seam at the arrow).
            "max-w-xs break-words rounded-[12px] bg-[#4a4a4d] px-3 py-1.5 text-[13px] font-medium leading-snug text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)]",
            "origin-(--transform-origin) transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
          {/* One triangle with a rounded tip, drawn pointing down and turned
              for the other sides. It overlaps the box by 1px so no hairline
              of background shows at the join. */}
          <TooltipPrimitive.Arrow className="flex h-2 w-4 data-[side=bottom]:-top-[7px] data-[side=bottom]:rotate-180 data-[side=left]:-right-[11px] data-[side=left]:-rotate-90 data-[side=right]:-left-[11px] data-[side=right]:rotate-90 data-[side=top]:-bottom-[7px]">
            <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden>
              <path d="M0 0H16L9.4 6.6Q8 8 6.6 6.6Z" fill="#4a4a4d" />
            </svg>
          </TooltipPrimitive.Arrow>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/** A field's error, shown above it as the tooltip while there is one (user
 *  2026-09-27: every field error, instead of red text under the field), and
 *  gone as soon as you click or tab back into the field. Open is driven by the message alone, not by hover. The wrapper
 *  is the anchor, so any field, however it's built, can sit inside. */
function ErrorTip({
  message,
  onDismiss,
  className,
  children,
}: {
  message: string | null | undefined;
  /** Clicking or tabbing into the field dismisses its error (user
   *  2026-09-27); the caller clears its message (and any red border). */
  onDismiss?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  // Keep showing the last message while the tooltip animates out: emptying
  // it at once collapsed the box mid-exit and left the arrow trailing
  // (user 2026-09-27). Adjusting state during render is React's pattern for
  // state derived from a prop.
  const [shown, setShown] = useState(message ?? "");
  if (message && message !== shown) setShown(message);

  return (
    <TooltipPrimitive.Root open={Boolean(message)}>
      <TooltipPrimitive.Trigger
        render={
          <div
            className={className}
            onFocusCapture={() => {
              if (message) onDismiss?.();
            }}
            onPointerDownCapture={() => {
              if (message) onDismiss?.();
            }}
          />
        }
        // Keyboard focus shouldn't be able to open an empty one.
        tabIndex={-1}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipContent side="top" sideOffset={8}>
        <span role="alert">{shown}</span>
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

export { ErrorTip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
