"use client";

import type { ReactNode } from "react";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";
import { CTA_CLASS } from "@/components/ui/tokens";

/** The shell every setup screen composes, so a new screen never invents its
 *  own type scale, spacing or button.
 *
 *  The rule it encodes (user, 2026-09-21): **one heading, one sub-line and one
 *  action per screen.** A question whose answers are choices is still one
 *  decision — an action plus a bail-out is two, and doesn't belong here.
 */

export function SetupHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
    >
      {children}
    </h2>
  );
}

export function SetupBody({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${sohne.className} mt-3 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
    >
      {children}
    </p>
  );
}

/** Field-level feedback. Not a second sub-line: it only exists when something
 *  went wrong, and it reads as an error, not as body copy. */
export function SetupError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {children}
    </p>
  );
}

/** The screen's one action. Never disabled, never greyed: incomplete work is
 *  handled like Book a Demo — Continue stays black, fields shake/red on click. */
export function SetupAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className={cn(CTA_CLASS, satoshi.className, "bg-black")}
      >
        {label}
      </button>
    </div>
  );
}

/** A stack of answer buttons — the Yes / No shape. Press scale matches Continue. */
export const SETUP_CHOICE_CLASS =
  "relative flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-95";

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
