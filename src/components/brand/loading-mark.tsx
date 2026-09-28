"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const TURN_MS = 1000;

/** The site's loading state: the Knohow mark turning a quarter at a time,
 *  90° → 180° → +90° → +90°, one step a second (user 2026-09-27), in place
 *  of a spinner. Each step is a short eased snap, then a hold. Reduced
 *  motion keeps it still. */
export function LoadingMark({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTurns((t) => t + 1), TURN_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/knohow-mark.png"
      alt={label}
      role="status"
      width={1024}
      height={1169}
      className={cn(
        "transition-transform duration-[450ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
        className,
      )}
      style={{ transform: `rotate(${turns * 90}deg)` }}
    />
  );
}
