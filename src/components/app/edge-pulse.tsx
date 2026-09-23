"use client";

import { useEffect, useRef } from "react";

/** A point of light travelling once from a connector's source to its
 *  destination: information moved from A to B.
 *
 *  The brief (user 2026-09-22) and how each part is met:
 *
 *  - **The line never moves.** It is drawn by `FlowCanvas` and untouched here;
 *    this component only adds a dot that rides along the same path data.
 *  - **A small, discrete pulse**, not an orb: a 2.6px core with one restrained
 *    halo. No trail, no particles.
 *  - **Fast and intentional**, not a spinner: ~680ms with an ease that starts
 *    quickly and settles, so it reads as a transfer completing rather than
 *    something looping.
 *  - **It disappears on arrival** — the last fifth of the trip fades it out.
 *    It never bounces back.
 *  - **Periodic, not continuous**: a pulse fires, then nothing for seconds.
 *    `period` sets the gap and `delay` staggers edges so they don't fire in
 *    lockstep, which is what would make it read as decoration.
 *  - **Real events only.** The caller mounts this on an edge *because that team
 *    actually changed*; an edge with no news has a plain static line. Nothing
 *    here invents traffic.
 *
 *  Position comes from `getPointAtLength` on the real path element, so a pulse
 *  follows a card being dragged mid-flight rather than animating along a stale
 *  copy of the curve.
 *
 *  Honours `prefers-reduced-motion`: the pulse simply never runs. The badge on
 *  the team card carries the same information without moving. */
export function EdgePulse({
  /** The connector this rides. Same `d` the line is drawn with. */
  d,
  /** Milliseconds between pulses. */
  period = 7000,
  /** Offset into the cycle, so edges fire at different moments. */
  delay = 0,
  // Ink, not the change-blue (user 2026-09-22): on a dotted grey canvas the
  // blue read as a status colour rather than as something moving.
  color = "#1c1917",
}: {
  d: string;
  period?: number;
  delay?: number;
  color?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const TRAVEL = 680;
    let frame = 0;
    let start = performance.now() + delay;

    // Starts quickly, settles into the destination: a transfer arriving, not
    // a constant-speed loop.
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = now - start;
      if (elapsed < 0) {
        dot.style.opacity = "0";
        return;
      }
      if (elapsed > TRAVEL) {
        dot.style.opacity = "0";
        if (elapsed > period) start = now;
        return;
      }
      const t = ease(elapsed / TRAVEL);
      const length = path.getTotalLength();
      if (!length) return;
      // Reversed: the change happened in the team and travels up to the
      // owner, which is the direction oversight actually flows.
      const point = path.getPointAtLength(length * (1 - t));
      dot.setAttribute("transform", `translate(${point.x} ${point.y})`);
      // Fade out over the last fifth rather than vanishing at the end.
      dot.style.opacity = t > 0.8 ? String((1 - t) / 0.2) : "1";
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [d, period, delay]);

  return (
    <>
      {/* Not drawn — it exists so the dot can be positioned along the real
          geometry. The visible line is the canvas's own. */}
      <path ref={pathRef} d={d} fill="none" stroke="none" />
      <g ref={dotRef} style={{ opacity: 0 }}>
        <circle r={5} fill={color} opacity={0.14} />
        <circle r={2.6} fill={color} />
      </g>
    </>
  );
}
