import type { Shape } from "@/lib/identity/composition";
import { teamComposition } from "@/lib/identity/composition";
import { cn } from "@/lib/utils";

/** A team's generated icon.
 *
 *  The renderer is deliberately dumb: every decision was already made by
 *  `teamComposition`, which is a pure function of the team's name. Same name,
 *  same icon, on the server and in the browser, today and next year.
 *
 *  The name is a **seed only** — nothing here reads it or means anything by
 *  it. No letters, no initials, no metaphors.
 *
 *  The circle is a CSS clip on the wrapper rather than an SVG `clipPath`, so
 *  the file needs no generated ids and shapes can be laid out past the edge
 *  and bitten off by the boundary, which is part of the language. */
export function TeamIcon({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const { ground, shapes } = teamComposition(name);
  return (
    <span
      role="img"
      aria-label={`${name} icon`}
      className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size, background: ground }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="block"
        aria-hidden
      >
        {shapes.map((shape, i) => (
          <g
            key={i}
            transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
          >
            {form(shape)}
          </g>
        ))}
      </svg>
    </span>
  );
}

/** One form from the vocabulary, drawn centred on the origin. Anything with a
 *  stroke gets round caps and joins: the geometry stays precise, the ends stay
 *  soft, and nothing in the set has a hairline. */
function form(shape: Shape) {
  const { kind, size, color } = shape;
  const r = size / 2;
  const stroke = {
    fill: "none",
    stroke: color,
    strokeWidth: shape.weight ?? 10,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "disc":
      return <circle r={r} fill={color} />;
    case "semicircle":
      return <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`} fill={color} />;
    case "quarter":
      return (
        <path d={`M 0 0 L ${r} 0 A ${r} ${r} 0 0 1 0 ${r} Z`} fill={color} />
      );
    case "capsule": {
      const h = size * 0.42;
      return (
        <rect
          x={-r}
          y={-h / 2}
          width={size}
          height={h}
          rx={h / 2}
          fill={color}
        />
      );
    }
    case "block": {
      const h = size * 0.78;
      return (
        <rect
          x={-r}
          y={-h / 2}
          width={size}
          height={h}
          rx={size * 0.12}
          fill={color}
        />
      );
    }
    case "wedge": {
      // A 70° slice, corner on the origin.
      const a = (70 * Math.PI) / 180;
      return (
        <path
          d={`M 0 0 L ${r} 0 A ${r} ${r} 0 0 1 ${r * Math.cos(a)} ${r * Math.sin(a)} Z`}
          fill={color}
        />
      );
    }
    case "ring":
      return <circle r={r} {...stroke} />;
    case "arc":
      // ~140° of the circle, open.
      return (
        <path
          d={`M ${-r * 0.77} ${r * 0.64} A ${r} ${r} 0 1 1 ${r * 0.77} ${r * 0.64}`}
          {...stroke}
        />
      );
    case "wave":
      return (
        <path
          d={`M ${-r} 0 Q ${-r / 2} ${-r * 0.7} 0 0 T ${r} 0`}
          {...stroke}
        />
      );
    case "zigzag":
      return (
        <polyline
          points={`${-r},${r * 0.5} ${-r / 3},${-r * 0.5} ${r / 3},${r * 0.5} ${r},${-r * 0.5}`}
          {...stroke}
        />
      );
  }
}
