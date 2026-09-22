import type { Rng } from "@/lib/identity/seed";

/** The identity system's colors, ordered around the hue wheel.
 *
 *  Order is the whole point: harmony comes from *where* two colors sit
 *  relative to each other, not from a list of hand-written pairs. Neighbours
 *  are analogous, opposites are complementary, and the picker below only ever
 *  asks for those two relationships — which is why a generated icon looks
 *  chosen rather than shuffled. */
export const PALETTE = [
  "#6D4AFF", // violet
  "#4436E8", // indigo
  "#1F6FEB", // electric blue
  "#0FA8D6", // cyan
  "#0E9C8A", // teal
  "#16A34A", // emerald
  "#84CC16", // lime
  "#F5C40A", // yellow
  "#FB8C2B", // orange
  "#FF6B4A", // coral
  "#FF5DA2", // pink
  "#D63AC9", // magenta
] as const;

/** The ground a composition can sit on when it isn't sitting on a color.
 *  Matches the app's own surfaces rather than pure white. */
export const NEUTRAL_GROUND = "#F4F2EE";
export const INK = "#171422";

/** A darker tonal variant of the same hue, for a second plane that reads as
 *  depth rather than as another color. */
export function shade(hex: string, amount = 0.32): string {
  return mix(hex, INK, amount);
}

/** A lighter variant, for the same reason in the other direction. */
export function tint(hex: string, amount = 0.3): string {
  return mix(hex, "#FFFFFF", amount);
}

function mix(a: string, b: string, amount: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const ch = (i: number) =>
    Math.round(pa[i] + (pb[i] - pa[i]) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Relative luminance, so a composition can decide whether it needs light or
 *  dark shapes on top of its ground. */
export function isDark(hex: string): boolean {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.42;
}

/** `count` colors that belong together: one anchor, then either neighbours on
 *  the wheel (analogous, calm) or the far side (complementary, punchy). Never
 *  an arbitrary handful — that's the difference between a palette and a pile. */
export function harmony(rng: Rng, count: number): string[] {
  const size = PALETTE.length;
  const anchor = rng.int(0, size - 1);
  const analogous = rng.chance(0.6);
  const picked = [anchor];

  // Bounded, so a small neighbourhood can't spin: if the seeded steps keep
  // landing on colors already taken, we fall through to the sweep below.
  for (let attempt = 0; attempt < 24 && picked.length < count; attempt += 1) {
    const step = analogous
      ? rng.one([-2, -1, 1, 2])
      : rng.one([-6, -5, 5, 6]);
    const next = (anchor + step + size * 2) % size;
    if (!picked.includes(next)) picked.push(next);
  }
  // Nearest unused, walking outwards from the anchor. Keeps the set tight
  // around one region of the wheel instead of reaching for a random color.
  for (let d = 1; picked.length < count && d < size; d += 1) {
    for (const s of [d, -d]) {
      const c = (anchor + s + size * 2) % size;
      if (!picked.includes(c)) {
        picked.push(c);
        break;
      }
    }
  }
  return picked.slice(0, count).map((i) => PALETTE[i]);
}
