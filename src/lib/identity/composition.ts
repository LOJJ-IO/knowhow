import {
  harmony,
  isDark,
  NEUTRAL_GROUND,
  shade,
  tint,
} from "@/lib/identity/palette";
import { identitySeed, rngFrom } from "@/lib/identity/seed";

/** The visual grammar for a team's icon.
 *
 *  This file is the whole design system: a small vocabulary of forms, a rule
 *  for how many of them appear, and where they may sit. The renderer draws
 *  whatever this returns and makes no decisions of its own.
 *
 *  The distinction that matters: the randomness here is **constrained**.
 *  Shapes come from a fixed vocabulary, angles from a fixed set, positions
 *  from a grid, colors from one region of the hue wheel. Nothing is free to
 *  be arbitrary, which is what keeps two icons recognisably from the same
 *  system while still being different.
 *
 *  The team's **name is only ever a seed**. Nothing here reads it, matches on
 *  it, or means anything by it: "Engineering", "Marketing" and "Finance" draw
 *  from exactly the same vocabulary. No letters, no initials, no metaphors. */

/** The form vocabulary. Adding one changes every icon that seeds into it, so
 *  this list is a versioned decision, not a scratchpad. */
export type ShapeKind =
  | "disc"
  | "semicircle"
  | "quarter"
  | "capsule"
  | "block"
  | "ring"
  | "arc"
  | "wedge"
  | "wave"
  | "zigzag";

const FILLED: ShapeKind[] = [
  "disc",
  "semicircle",
  "quarter",
  "capsule",
  "block",
  "wedge",
];
const STROKED: ShapeKind[] = ["ring", "arc", "wave", "zigzag"];

export type Shape = {
  kind: ShapeKind;
  /** Centre, in the 0–100 icon box. Shapes may sit past the edge: the circle
   *  clips them, and that clipping is part of the language. */
  x: number;
  y: number;
  /** Size of the shape's box, in the same units. */
  size: number;
  /** Degrees, always a multiple of 15 — precision is the point. */
  rotation: number;
  color: string;
  /** Stroke weight for the stroked forms; unused by filled ones. */
  weight?: number;
};

export type Composition = {
  seed: number;
  ground: string;
  shapes: Shape[];
};

/** Nine anchor points. A dominant shape takes the middle band; supporting
 *  shapes take the edges, where the circle will bite into them. */
const GRID = [
  [28, 28],
  [50, 24],
  [72, 28],
  [26, 50],
  [50, 50],
  [74, 50],
  [28, 72],
  [50, 76],
  [72, 72],
] as const;

const ANGLES = [0, 15, 30, 45, 60, 90, 120, 135, 180, 225, 270, 315] as const;

export function teamComposition(name: string): Composition {
  const seed = identitySeed(name);
  const rng = rngFrom(seed);

  // 2–4 shapes: one dominant, the rest supporting. Fewer than two reads as a
  // placeholder; more than four turns to mush at 32px.
  const count = rng.int(2, 4);
  const colors = harmony(rng, Math.min(count + 1, 4));

  // A colored ground most of the time; a neutral one often enough that the
  // set has quiet members. Either way the shapes must clear it, so the
  // ground's darkness decides whether they lighten or deepen.
  const coloredGround = rng.chance(0.68);
  const ground = coloredGround
    ? shade(colors[0], rng.float(0.1, 0.4))
    : NEUTRAL_GROUND;
  const groundIsDark = isDark(ground);

  const spots = rng.some(GRID, count);
  const shapes: Shape[] = spots.map(([gx, gy], index) => {
    const dominant = index === 0;
    const kind = rng.chance(dominant ? 0.72 : 0.5)
      ? rng.one(FILLED)
      : rng.one(STROKED);
    const base = colors[(index + 1) % colors.length];
    // On its own ground a color can vanish; push it the other way instead of
    // hoping. Tonal variants of the same hue keep the icon from turning into
    // a swatch collection.
    const color = groundIsDark
      ? tint(base, rng.float(0.05, 0.3))
      : shade(base, rng.float(0, 0.22));
    return {
      kind,
      // The dominant shape sits near the middle; supporting ones keep their
      // grid spot, with a little seeded drift so the set isn't a lattice.
      x: dominant ? 50 + rng.float(-10, 10) : gx + rng.float(-6, 6),
      y: dominant ? 50 + rng.float(-10, 10) : gy + rng.float(-6, 6),
      size: dominant ? rng.float(58, 96) : rng.float(24, 52),
      rotation: rng.one(ANGLES),
      color,
      weight: rng.float(7, 13),
    };
  });

  // Every composition needs mass. A seed that happens to pick a stroked form
  // for all of its shapes reads as a sketch rather than an icon, so the
  // dominant one is promoted to a filled form. Deterministic: same seed, same
  // promotion.
  if (!shapes.some((shape) => FILLED.includes(shape.kind)))
    shapes[0] = { ...shapes[0], kind: rng.one(FILLED) };

  return { seed, ground, shapes };
}

/** A person's avatar: a gradient field, not a composition. People get
 *  something calmer than teams on purpose — a wall of geometric icons with
 *  faces mixed in reads as noise. */
export type GradientStop = {
  /** Centre of this light source, 0–100. */
  x: number;
  y: number;
  /** Radius, in the same units. Deliberately large: soft fields, not dots. */
  r: number;
  color: string;
  opacity: number;
};

export type GradientField = {
  seed: number;
  base: string;
  stops: GradientStop[];
  /** Blur applied to the whole field, so the stops read as one material. */
  blur: number;
  /** Degrees; rotates the field so two avatars with similar colors still
   *  differ in topology. */
  rotation: number;
};

/** The one colour a person's fluid orb is built from. Same seed and the same
 *  first pick as `personGradient`, so swapping the avatar's renderer didn't
 *  change anyone's colour. */
export function personColor(identity: string): string {
  const rng = rngFrom(identitySeed(identity));
  return harmony(rng, rng.int(2, 4))[0];
}

export function personGradient(identity: string): GradientField {
  const seed = identitySeed(identity);
  const rng = rngFrom(seed);
  const colors = harmony(rng, rng.int(2, 4));
  const base = shade(colors[0], rng.float(0.12, 0.4));
  return {
    seed,
    base,
    // Each light source gets its own quadrant-ish region, so the topology
    // differs per avatar instead of every one glowing from the middle.
    stops: colors.map((color, i) => ({
      x: rng.float(i % 2 === 0 ? 8 : 48, i % 2 === 0 ? 62 : 96),
      y: rng.float(i < 2 ? 6 : 44, i < 2 ? 58 : 96),
      r: rng.float(44, 82),
      color: i === 0 ? tint(color, rng.float(0.1, 0.3)) : color,
      opacity: rng.float(0.62, 0.95),
    })),
    blur: rng.float(7, 13),
    rotation: rng.one(ANGLES),
  };
}
