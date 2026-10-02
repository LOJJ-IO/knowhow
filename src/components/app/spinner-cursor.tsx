"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Spinner } from "@/components/ui/icons";

/** The mouse pointer becomes the landing's Get Started spinner while
 *  `active` (user 2026-09-29). Browsers can't animate a real cursor, so the
 *  real one is hidden (`html[data-spinner-cursor]` in globals.css) and the
 *  spinner is drawn where the pointer is, following it. `from` is where the
 *  pointer was when it started (the click), so it appears in place at once. */
export function SpinnerCursor({
  active,
  from,
}: {
  active: boolean;
  from: { x: number; y: number } | null;
}) {
  const [at, setAt] = useState(from);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.spinnerCursor = "";
    const move = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => {
      delete root.dataset.spinnerCursor;
      window.removeEventListener("pointermove", move);
    };
  }, [active]);

  const point = at ?? from;
  if (!active || !point) return null;
  return createPortal(
    <span
      aria-hidden
      className="pointer-events-none fixed z-[700] -translate-x-1/2 -translate-y-1/2 text-[#1c1917]"
      style={{ left: point.x, top: point.y }}
    >
      <Spinner size={20} />
    </span>,
    document.body,
  );
}
