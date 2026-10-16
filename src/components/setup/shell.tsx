"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LoginBackSlotContext } from "@/components/login/login-modal";
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

/** Where a setup screen's back arrow goes. Provided by whoever owns the
 *  sequence (setup → the previous step, the first step → sign out and back to
 *  Log In), so every screen gets one without wiring it through each step
 *  (cofounder, 2026-10-13: "there should be a back button at every step"). */
export const SetupBackContext = createContext<(() => void) | null>(null);

/** Every setup / account-picker back chevron. Inside the Log In card it sits
 *  outside the card on its left, in a circle with the card's own surface,
 *  border and shadow so it reads as clearly as the card (Ronald, 2026-10-15).
 *  Anywhere else it stays inline before the heading. */
export function SetupBackButton({ onClick }: { onClick: () => void }) {
  const slot = useContext(LoginBackSlotContext);
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className={
        slot
          ? "t-login-back pointer-events-auto flex size-11 cursor-pointer items-center justify-center text-[#1c1917] transition-transform duration-150 active:scale-95"
          : "-ml-1 mt-[0.1rem] flex size-7 shrink-0 cursor-pointer items-center justify-center text-[#1c1917] transition-transform duration-150 active:scale-95"
      }
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
  return slot ? createPortal(button, slot) : button;
}

/** `onBack` overrides the context for a sub-screen inside one step (e.g. the
 *  email field after "Yes, invite them" goes back to that question). `null`
 *  hides the arrow. */
export function SetupHeading({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack?: (() => void) | null;
}) {
  const fromContext = useContext(SetupBackContext);
  const back = onBack === undefined ? fromContext : onBack;
  const heading = (
    <h2
      className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
    >
      {children}
    </h2>
  );
  return back ? (
    <div className="flex items-start gap-2 pl-[7%] pr-[3%]">
      <SetupBackButton onClick={back} />
      {heading}
    </div>
  ) : (
    <div className="pl-[7%] pr-[3%]">{heading}</div>
  );
}

export function SetupBody({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${sohne.className} mt-3 pl-[7%] pr-[3%] text-[0.95rem] leading-[1.6] text-[#1c1917]`}
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
    <div className="mx-[2.5%] mt-8 flex justify-end">
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

/** A choice worded "Answer, the rest" (Yes, … / No, …): the answer bold, the
 *  rest medium, not thin (user 2026-09-27). Anything else renders as given. */
export function ChoiceLabel({ children }: { children: string }) {
  const comma = children.indexOf(", ");
  if (comma < 0) return children;
  return (
    <>
      <span className="font-bold">{children.slice(0, comma + 1)}</span>
      <span className="font-medium">&nbsp;{children.slice(comma + 2)}</span>
    </>
  );
}

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

/** "owner", with its definition (ADR-0023 wording, user 2026-09-27). */
export function OwnerTerm() {
  return (
    <SetupTerm definition="The person at the top of your organization in Knohow. They approve org-wide decisions. They may not be the same as your Google Workspace Super Admin.">
      owner
    </SetupTerm>
  );
}

/** A term in a sub-line with its definition on hover or focus ("owner",
 *  "Super Admin"): the same tooltip as the Log In sheet's (account picker,
 *  copy field) — Satoshi, default padding, 6px off. The `?` help cursor says
 *  there's more to read; with `href` (it links out) it's the pointer. */
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
          sideOffset={6}
          className={satoshi.className}
        >
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
