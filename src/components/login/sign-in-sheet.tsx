"use client";

import { satoshi } from "@/components/brand/fonts";
import { LoginSky } from "@/components/login/login-sky";
import { LoginModal } from "@/components/login/login-modal";
import { CTA_CLASS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/** The full-screen sky sheet with the centred card: Close top-right, the
 *  Edmonton mark bottom-left. The landing slides it up for Book a Demo and on
 *  the way to Log In; the app's front door (ADR 0022) renders it already at
 *  the top. One component so the two never drift apart. */
export function SignInSheet({
  open,
  atTop,
  cardOpen,
  onClose,
  onReachedTop,
  topLeft,
  sheetRef,
  children,
}: {
  /** Slid up (or, on the app, simply there). */
  open: boolean;
  /** Finished sliding — square corners from then on. */
  atTop: boolean;
  /** The card has grown from its closed line to its content. */
  cardOpen: boolean;
  onClose: () => void;
  onReachedTop?: () => void;
  topLeft?: React.ReactNode;
  sheetRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[400] h-dvh w-full overflow-hidden overscroll-none bg-white t-signin-bg transition-[translate,border-radius] duration-992 ease-[var(--resize-ease)] flex flex-col",
        open ? "translate-y-0" : "translate-y-full",
        atTop ? "rounded-none" : "rounded-[var(--deck-window-radius)]",
      )}
      // Slides at 992ms (the recess + veil stay 900ms). Only the panel's own
      // slide counts — the Close button's press transition bubbles here too.
      onTransitionEnd={(e) => {
        if (
          open &&
          e.target === e.currentTarget &&
          e.propertyName === "translate"
        )
          onReachedTop?.();
      }}
    >
      <LoginSky active={open} />
      <div
        className={`${satoshi.className} relative z-10 flex items-center justify-between gap-2 p-6`}
      >
        {topLeft}
        <button
          type="button"
          onClick={onClose}
          className={cn(CTA_CLASS, "ml-auto")}
        >
          Close
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/edmonton.png"
          alt="Proudly from Edmonton"
          className="h-8 w-auto md:h-10"
        />
      </div>
      {/* Centred modal. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <LoginModal open={cardOpen}>{children}</LoginModal>
      </div>
    </div>
  );
}
