/** Seeded randomness. The whole identity system rests on this file: given the
 *  same string it must produce the same numbers, forever, on the server and in
 *  the browser.
 *
 *  So: no `Math.random`, no `Date`, no locale-dependent anything. "Engineering"
 *  hashes to one number today and the same number next year, which is what
 *  makes a generated icon an identity rather than decoration. */

/** xmur3 — string to a well-mixed uint32. */
export function seedFrom(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export type Rng = {
  /** [0, 1) */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  one<T>(items: readonly T[]): T;
  /** `count` distinct items, in a seeded order. */
  some<T>(items: readonly T[], count: number): T[];
  /** True with probability `p`. */
  chance(p: number): boolean;
};

/** mulberry32 — small, fast, good enough for geometry, fully deterministic. */
export function rngFrom(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const rng: Rng = {
    next,
    int,
    float: (min, max) => min + next() * (max - min),
    one: (items) => items[int(0, items.length - 1)],
    some: (items, count) => {
      // Fisher-Yates on a copy: distinct items, seeded order.
      const pool = [...items];
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, Math.min(count, pool.length));
    },
    chance: (p) => next() < p,
  };
  return rng;
}

/** The seed for a name, case- and space-insensitive so "Engineering" and
 *  " engineering " are the same identity — a rename that only changes casing
 *  must not hand a team a different icon. */
export function identitySeed(input: string): number {
  return seedFrom(input.trim().toLowerCase().replace(/\s+/g, " "));
}
