"use client";

import type { ReactNode } from "react";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";
import { CTA_CLASS } from "@/components/ui/tokens";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** The shell every setup screen composes, so a new screen never invents its
 *  own type scale, spacing or button.
 *
 *  The rule it encodes (user, 2026-09-21): **one heading, one sub-line and one
 *  action per screen.** A question whose answers are choices is still one
 *  decision — an action plus a bail-out is two, and doesn't belong here.
 *
 *  Heading and sub-line start 5% of the card's width in from the left, with
 *  fields and actions left where they are (user, 2026-09-27).
 */

export function SetupHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      className={`${sohne.className} m-0 pl-[5%] text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
    >
      {children}
    </h2>
  );
}

export function SetupBody({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${sohne.className} mt-3 pl-[5%] text-[0.95rem] leading-[1.6] text-[#1c1917]`}
    >
      {children}
    </p>
  );
}

/** Field-level feedback. Not a second sub-line: it only exists when something
 *  went wrong, and it reads as an error, not as body copy.
 *
 *  Plain `children` is a one-line error. For more, pass a bold `title` (what
 *  went wrong), optional `items` (the specifics, as a list) and `children` as
 *  the next step, instead of packing it all into one sentence. */
export function SetupError({
  title,
  items,
  children,
}: {
  title?: string;
  items?: string[];
  children?: string;
}) {
  if (!title && !children) return null;
  return (
    <div
      aria-live="polite"
      className={`${satoshi.className} mx-[2.5%] mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {title ? <p className="m-0 font-bold">{title}</p> : null}
      {items?.length ? (
        <ul className="m-0 mt-1 list-disc pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {children ? (
        <p className={cn("m-0", title && "mt-1")}>{children}</p>
      ) : null}
    </div>
  );
}

/** The screen's one action. Never disabled, never greyed: incomplete work is
 *  handled like Book a Demo — Continue stays black, fields shake/red on click. */
export function SetupAction({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  /** Sits in front of the label (the Google G on "Check with Google"). */
  icon?: ReactNode;
}) {
  return (
    // 32px above: a little more room between the content and the action
    // (user, 2026-09-27).
    <div className="mt-8 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className={cn(CTA_CLASS, satoshi.className, "bg-black", icon && "gap-2.5")}
      >
        {icon}
        {label}
      </button>
    </div>
  );
}

/** A stack of answer buttons — the Yes / No shape. Press scale matches Continue.
 *  Inset 2.5% each side, like the org name field (user, 2026-09-27). */
export const SETUP_CHOICE_CLASS =
  "relative mx-[2.5%] flex h-12 w-[95%] cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-95";

export function SetupChoices({ children }: { children: ReactNode }) {
  return (
    <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
      {children}
    </div>
  );
}

/** One text field, styled the way every setup field is. */
export function SetupField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    inputRef?: React.Ref<HTMLInputElement>;
  },
) {
  const { inputRef, className, ...rest } = props;
  return (
    <div className={`t-input-wrap ${satoshi.className} flex flex-col`}>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        {...rest}
        className={cn(
          "t-input t-demo-input h-10 w-full min-w-0 rounded-[var(--login-button-radius)] border bg-white px-3 text-[0.95rem] text-[#1c1917] outline-none",
          className,
        )}
      />
    </div>
  );
}

/** Book-a-Demo-style field error: red border + shake. Restart by calling again. */
export function shakeSetupField(input: HTMLInputElement | null) {
  const wrap = input?.closest(".t-input-wrap");
  if (!input || !(wrap instanceof HTMLElement)) return;
  wrap.classList.remove("is-error", "is-shaking");
  input.classList.remove("is-error", "is-shaking");
  void wrap.offsetWidth;
  wrap.classList.add("is-error", "is-shaking");
  input.classList.add("is-error", "is-shaking");
  input.setAttribute("aria-invalid", "true");
}

export function clearSetupFieldError(input: HTMLInputElement | null) {
  const wrap = input?.closest(".t-input-wrap");
  if (!input || !(wrap instanceof HTMLElement)) return;
  wrap.classList.remove("is-error", "is-shaking");
  input.classList.remove("is-error", "is-shaking");
  input.removeAttribute("aria-invalid");
}

/** What "Super Admin" means, wherever setup names it (user-picked 2026-09-27). */
export const SUPER_ADMIN_DEFINITION =
  "The person with full control of your company's Google accounts, usually IT or whoever set up your company email. They can add people, reset passwords and connect apps like Knohow.";

/** A term in a sub-line with its definition on hover or focus ("owner",
 *  "Super Admin"): the app's black tooltip, wider and roomier for a full
 *  sentence. Pass `href` when the term also links out (it then keeps the
 *  pointer cursor); otherwise the help cursor says there's more to read. */
export function SetupTerm({
  children,
  definition,
  href,
}: {
  children: ReactNode;
  definition: ReactNode;
  href?: string;
}) {
  const className =
    "underline decoration-[#1c1917]/40 underline-offset-2 " +
    (href ? "cursor-pointer" : "cursor-help");
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={className}
              />
            ) : (
              <span tabIndex={0} className={className} />
            )
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="max-w-[18rem] px-3 py-2 text-[13px]"
        >
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
