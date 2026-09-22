import { personGradient } from "@/lib/identity/composition";
import { cn } from "@/lib/utils";

/** A person's generated avatar: a gradient field, nothing else.
 *
 *  People get something calmer than teams on purpose — a wall of geometric
 *  compositions with faces mixed into it reads as noise. Seeded from the
 *  person's email, so the same person is the same avatar everywhere, with no
 *  initials, letters or shapes in it.
 *
 *  Ids are keyed by the seed: two avatars for the same person on one page
 *  share a definition, which is exactly what they should do. */
export function PersonAvatar({
  identity,
  label,
  size = 36,
  className,
}: {
  /** What seeds the gradient. The person's email, normally. */
  identity: string;
  /** For assistive tech. Their name, if we have one. */
  label?: string;
  size?: number;
  className?: string;
}) {
  const { seed, base, stops, blur, rotation } = personGradient(identity);
  const blurId = `pa-${seed}-blur`;

  return (
    <span
      role="img"
      aria-label={label ? `${label} avatar` : "Avatar"}
      className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size, background: base }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="block"
        aria-hidden
      >
        <defs>
          {stops.map((stop, i) => (
            <radialGradient key={i} id={`pa-${seed}-${i}`}>
              <stop offset="0%" stopColor={stop.color} stopOpacity={stop.opacity} />
              <stop offset="60%" stopColor={stop.color} stopOpacity={stop.opacity * 0.55} />
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
    </span>
  );
}
