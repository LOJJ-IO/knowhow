"use client";

import { useState } from "react";

import { FluidOrb } from "@/components/identity/fluid-orb";
import { personColor, personGradient } from "@/lib/identity/composition";
import { cn } from "@/lib/utils";

/** A person's generated avatar: a fluid orb, drifting in their own colour
 *  (user 2026-09-22, replacing the static gradient field).
 *
 *  People get something calmer than teams on purpose — a wall of geometric
 *  compositions with faces mixed into it reads as noise. Seeded from the
 *  person's email, so the same person is the same avatar everywhere, with no
 *  initials, letters or shapes in it. `personColor` reuses `personGradient`'s
 *  seed and first pick, so nobody's colour changed in the swap.
 *
 *  **The gradient it replaced is still underneath**, and it is not decoration:
 *  the orb needs a live WebGL context, and a page has a limited number of them
 *  (see `FluidOrb`). Where one can't be had — past the budget, no WebGL, a
 *  context lost — the avatar is the gradient, at the same size and the same
 *  hue, and nothing about the layout notices. */
export function PersonAvatar({
  identity,
  label,
  size = 36,
  className,
}: {
  /** What seeds the avatar. The person's email, normally. */
  identity: string;
  /** For assistive tech. Their name, if we have one. */
  label?: string;
  size?: number;
  className?: string;
}) {
  const { seed, base, stops, blur, rotation } = personGradient(identity);
  const blurId = `pa-${seed}-blur`;
  /** The gradient steps aside once the orb is live: the orb's edge fades to
   *  transparent, so a field left behind it reads as a coloured rim. */
  const [orb, setOrb] = useState(false);

  return (
    <span
      role="img"
      aria-label={label ? `${label} avatar` : "Avatar"}
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size, background: orb ? undefined : base }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={cn(
          "block transition-opacity duration-200",
          orb && "opacity-0",
        )}
        aria-hidden
      >
        <defs>
          {stops.map((stop, i) => (
            <radialGradient key={i} id={`pa-${seed}-${i}`}>
              <stop
                offset="0%"
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
              <stop
                offset="60%"
                stopColor={stop.color}
                stopOpacity={stop.opacity * 0.55}
              />
              <stop offset="100%" stopColor={stop.color} stopOpacity={0} />
            </radialGradient>
          ))}
          {/* One blur over the whole field, so the light sources read as a
              single translucent material rather than as stacked blobs. */}
          <filter id={blurId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        <g filter={`url(#${blurId})`} transform={`rotate(${rotation} 50 50)`}>
          {stops.map((stop, i) => (
            <circle
              key={i}
              cx={stop.x}
              cy={stop.y}
              r={stop.r}
              fill={`url(#pa-${seed}-${i})`}
            />
          ))}
        </g>
      </svg>

      <FluidOrb
        size={size}
        color={personColor(identity)}
        className="absolute inset-0"
        onPainted={setOrb}
      />
    </span>
  );
}
