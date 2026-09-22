"use client";

/** Seeding alone isn't enough: `Math.pow` can differ in the last bit between
 *  Node and the browser, and a style string that differs by one digit is a
 *  hydration mismatch. Rounding every value makes them identical. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The sign-in sheet's sky: stars seeded so server and client agree, and the
 *  occasional shooting star. Decoration only — it owns no state the sheet
 *  needs. */

/** Log In panel sky — deterministic (seeded) so server and client render the
 *  same stars. Stars sit in the top half, where signinbg.png is dark blue, and
 *  thin out towards the horizon glow. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const LOGIN_STARS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 90 }, () => {
    const y = Math.pow(rand(), 1.6) * 52;
    return {
      x: round3(rand() * 100),
      y: round3(y),
      size: rand() < 0.15 ? 2.5 : rand() < 0.5 ? 1.75 : 1.25,
      /** Dimmer lower down, where the sky is lighter. */
      peak: round3(0.95 - (y / 52) * 0.55),
      dur: round3(2.5 + rand() * 4),
      delay: round3(-rand() * 6),
    };
  });
})();

/** Each streak runs on its own long loop and is only visible for the first
 *  few percent of it, so they cross at staggered, irregular-feeling times. */
const LOGIN_SHOOTING_STARS = [
  { x: 22, y: 6, loop: 7, delay: 1.2, len: 140 },
  { x: 55, y: 12, loop: 11, delay: 4.5, len: 110 },
  { x: 8, y: 22, loop: 13, delay: 8, len: 170 },
];

export function LoginSky({ active }: { active: boolean }) {
  return (
    <div
      className="t-login-sky pointer-events-none absolute inset-0 overflow-hidden"
      data-active={active ? "true" : "false"}
      aria-hidden
    >
      {LOGIN_STARS.map((star, i) => (
        <span
          key={i}
          className="t-login-star"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              "--star-peak": star.peak,
              animationDuration: `${star.dur}s`,
              animationDelay: `${star.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
      {LOGIN_SHOOTING_STARS.map((star, i) => (
        <span
          key={i}
          className="t-login-shooting-star"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.len,
              animationDuration: `${star.loop}s`,
              animationDelay: `${star.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
