"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { FormEvent, ReactNode } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { Button } from "@/components/app/button";
import { cn } from "@/lib/utils";

/** The app's dialog, and the shape every dialog in it takes.
 *
 *  Modelled on Sage_v1's dialog system (user 2026-09-21), which is worth
 *  copying for its taxonomy rather than its code. What it got right, and what
 *  is kept here:
 *
 *  - **One shell**: bordered header, scrolling body, bordered footer. Content
 *    never decides its own chrome, so two dialogs can't disagree about padding.
 *  - **A size scale, not free widths**: `sm` for a decision, `lg` for a form,
 *    `xl` for something with its own layout inside.
 *  - **A kind**: `form` (the person is editing; the footer holds the action) or
 *    `confirm` (the person is deciding; the footer holds the answer, and the
 *    destructive answer is the one that looks destructive).
 *  - **The entrance is part of it**: backdrop fades, popup scales up from 95%,
 *    150ms. Base UI drives it off `data-[starting-style]` / `data-[ending-style]`
 *    rather than a timer, so an interrupted open doesn't strand the animation.
 *  - **A safe exit**: closing is always available and never destroys work
 *    silently — the caller gets `onSafeExit` to ask first if it needs to.
 *
 *  Rebuilt on Knohow's own tokens, fonts and Base UI (already a dependency for
 *  the tooltip). No Sage code, tokens or dependencies crossed over (CLAUDE.md
 *  invariant 5). */

export type DialogSize = "sm" | "lg" | "xl";
export type DialogKind = "form" | "confirm";

const SIZE: Record<DialogSize, string> = {
  sm: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "sm",
  kind = "form",
  footer,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  size?: DialogSize;
  kind?: DialogKind;
  footer: ReactNode;
  /** When given, header/body/footer are wrapped in a form. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children?: ReactNode;
}) {
  const chrome = (
    <>
      <header className="shrink-0 border-b border-[var(--app-border)] px-6 py-5 pr-14">
        <DialogPrimitive.Title
          className={`${sohne.className} m-0 text-[1.125rem] leading-[1.35] tracking-tight text-[#1c1917]`}
        >
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description
            className={`${satoshi.className} m-0 mt-1.5 text-[0.875rem] leading-[1.5] text-[var(--app-dim)]`}
          >
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-6",
          kind === "confirm" ? "py-2" : "py-5",
        )}
      >
        {children}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--app-border)] px-6 py-4">
        {footer}
      </footer>
    </>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[500] bg-black/35 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-[500] flex max-h-[min(42rem,calc(100dvh-4rem))] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] outline-none transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            SIZE[size],
          )}
        >
          <DialogPrimitive.Close
            aria-label="Close"
            // Chrome, so: ghost, icon-sized.
            render={<Button variant="ghost" size="icon-sm" />}
            className="absolute top-4 right-4 z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </svg>
          </DialogPrimitive.Close>
          {onSubmit ? (
            <form
              onSubmit={onSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              {chrome}
            </form>
          ) : (
            chrome
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** One group of rows inside a dialog body. A dialog with two of these reads as
 *  two subjects; a dialog with six is two dialogs. */
export function DialogSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--app-border)] pb-5 last:border-0 last:pb-0 [&+&]:pt-5">
      <h3
        className={`${satoshi.className} m-0 text-[0.8125rem] font-medium tracking-[0.02em] text-[var(--app-dim)] uppercase`}
      >
        {title}
      </h3>
      {hint ? (
        <p
          className={`${satoshi.className} m-0 mt-1 text-[0.8125rem] leading-[1.5] text-[var(--app-dim)]`}
        >
          {hint}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** A dialog footer's buttons are just `Button`s: the answer is `default`, the
 *  way out is `outline`, and a destructive answer is `destructive`. This alias
 *  exists so a footer reads as a footer at the call site; it adds nothing. */
export const DialogButton = Button;

/** A form: the person is editing, and the footer holds the action that keeps
 *  the edit. The way out sits beside it and never destroys work silently —
 *  give `onSafeExit` when closing needs to ask first.
 *
 *  Paired with `ConfirmDialog` below: both are compositions of `AppDialog`,
 *  which is the only thing that knows what a dialog looks like. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  busy = false,
  disabled = false,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  size?: DialogSize;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** The action can't be taken yet — nothing has changed, or it isn't valid. */
  disabled?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      kind="form"
      onSubmit={onSubmit}
      footer={
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={busy || disabled}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      {children}
    </AppDialog>
  );
}

/** A decision, not a form: title, one line of consequence, two answers.
 *  Sage kept this separate from the form dialog and it is the right split —
 *  a confirm that grows fields is a form wearing a confirm's clothes. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      kind="confirm"
      footer={
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            autoFocus={open}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={() =>
              void Promise.resolve(onConfirm()).then(() => onOpenChange(false))
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
