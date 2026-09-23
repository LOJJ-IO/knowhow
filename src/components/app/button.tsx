import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

/** The app's one button.
 *
 *  **Two axes, the same taxonomy the dialog system took from Sage_v1** (user
 *  2026-09-22, and see [[0017-dialogs-over-settings-screens]] for the dialog
 *  half):
 *
 *  | Axis | Values | Meaning |
 *  | --- | --- | --- |
 *  | `variant` | `default` · `outline` · `secondary` · `ghost` · `destructive` · `link` | *What kind of action it is.* `default` is the one thing this surface is for; `outline` is the way out beside it; `secondary` is a standing control that isn't the point of the screen; `ghost` is chrome that only appears under the pointer; `destructive` takes something away; `link` is prose that acts. |
 *  | `size` | `default` · `xs` · `sm` · `lg` · `icon` · `icon-xs` · `icon-sm` · `icon-lg` | *How much room it takes.* The `icon-*` half is the same scale with equal sides, for a button whose whole content is a glyph. |
 *
 *  One button per surface should be `default`; a screen with two of them has
 *  not decided what it is for.
 *
 *  What is **borrowed is the taxonomy, not the design** — the axis names, the
 *  value names and what they mean. Every class here is Knohow's own ink,
 *  surfaces and rounding, on Base UI (already a dependency), and no Sage code,
 *  token or dependency crossed over (CLAUDE.md invariant 5). Sage renders its
 *  own variants very differently: a gradient primary, a tinted destructive, an
 *  8px default row. Ours are flat, fully rounded and a size larger, because
 *  that is what the rest of this app is. */

export type ButtonVariant =
  "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";

export type ButtonSize =
  "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const VARIANT: Record<ButtonVariant, string> = {
  default: "bg-[#1c1917] text-white hover:bg-[#292524]",
  outline:
    "border border-[var(--app-border)] bg-white text-[#1c1917] hover:border-[#d9d9de]",
  secondary:
    "bg-[var(--app-muted)] text-[#44403c] hover:bg-[var(--app-active)]",
  ghost:
    "text-[var(--app-dim)] hover:bg-[var(--app-muted)] hover:text-[#1c1917]",
  destructive: "bg-[#EA4335] text-white hover:bg-[#d93327]",
  link: "text-[#1c1917] underline underline-offset-2 hover:no-underline",
};

const SIZE: Record<ButtonSize, string> = {
  default: "h-10 gap-1.5 px-4 text-[0.9375rem]",
  xs: "h-7 gap-1 px-2.5 text-[0.8125rem]",
  sm: "h-8 gap-1.5 px-3 text-[0.875rem]",
  lg: "h-12 gap-2 px-5 text-[1rem]",
  icon: "size-10",
  "icon-xs": "size-7",
  "icon-sm": "size-8",
  "icon-lg": "size-12",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonPrimitive.Props & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        satoshi.className,
        // Rounded-full is the app's button shape. The press is a **1px
        // nudge**, not the landing's `scale-95` (user 2026-09-22: "sometimes
        // when i click on buttons they dont fire"). A button that shrinks
        // under the pointer can finish its press outside its own box, and a
        // `click` is only dispatched when pointerdown and pointerup share a
        // target — so on small controls the press sometimes swallowed the
        // click. A translate keeps the hit area where the finger is, and it
        // is what Sage's own buttons do.
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,translate] duration-150 outline-none select-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917] disabled:cursor-default disabled:opacity-60 disabled:active:translate-y-0",
        VARIANT[variant],
        SIZE[size],
        // `link` is text, not a control with a body.
        variant === "link" && "h-auto px-0",
        className,
      )}
      {...props}
    />
  );
}
