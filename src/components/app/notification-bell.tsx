"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";

import { Button } from "@/components/app/button";
import { NAV_STROKE } from "@/components/app/icon";
import { cn } from "@/lib/utils";

/** The topbar's alerts control: the app's own icon button, plus a bell that
 *  rings and a badge that rolls.
 *
 *  **The shell is [[Button]] `variant="secondary" size="icon"`, not a styling of
 *  its own.** The component this grew out of shipped its own cool-grey surface
 *  (`#F4F4F9` / `#868593`) and no hover state at all, which read as a different
 *  control from everything beside it in the row (user 2026-09-25: "the
 *  notification bells style got changed from how it looked and behaved in
 *  hover"). Rendering the real Button instead means the warm `--app-muted` →
 *  `--app-active` hover, the 1px press, the focus outline and the 150ms curve
 *  all come from one place and cannot drift again. Only the bell and the badge
 *  live here.
 *
 *  **The glyph is lucide `Bell`'s own geometry**, the icon this control had
 *  before, inlined as two paths rather than drawn with `<AppIcon name="bell">`
 *  because the body and the clapper have to move independently. Same viewBox,
 *  stroke, width and caps lucide renders, so it is the same bell on screen.
 *
 *  **Three things make it ring**, all the same spring at different strengths so
 *  they read as one object: a new notification (hardest, scaled by how many
 *  arrived at once), a press, and a mouse arriving on it. The clapper is never
 *  animated directly — it lags the body's own velocity, so every one of the
 *  three swings it for free. Reduced motion silences all of them. */

// all sizes are a fraction of the size prop
const ICON = 0.55;
const BADGE = 0.38;
const DOT = 0.22;
const FONT = 0.21;
const PAD = 0.09;
// how far out the badge sits, 1 puts it right on the edge
const ORBIT = 0.9;

// low damping so it keeps swinging for a bit
const SWING_SPRING = {
  type: "spring",
  stiffness: 220,
  damping: 10,
  mass: 1,
  restDelta: 0.01,
} as const;
const CLAPPER_SPRING = { stiffness: 300, damping: 14, mass: 1 };
const COLUMN_SPRING = { stiffness: 400, damping: 30, mass: 0.9 };
const ENTER_SPRING = { type: "spring", stiffness: 600, damping: 20 } as const;
const FADE = { duration: 0.15 } as const;

// degrees per second
const IMPULSE = 500;
const MAX_VELOCITY = 900;
const BURST = 5;
const CLAPPER_SWEEP = 13;
const CLAPPER_VELOCITY = 450;

/** How hard each thing hits the bell, as a fraction of `IMPULSE`. A new
 *  notification is the loudest because it is the only one the person did not
 *  do themselves; hover is barely a nudge, so passing the pointer across the
 *  row doesn't feel like the app shouting. */
const RING_HOVER = 0.26;
const RING_PRESS = 0.5;

// how many digits to keep above and below, and how far behind the spring can get
const WINDOW = 3;
const LAG = 2;

// a taller window would show the next digit at rest, so the fade rides velocity instead
const ROLL_FADE = 34;
const ROLL_VELOCITY = 9;

const COLORS = {
  red: "bg-[#FF3B30]",
  orange: "bg-[#FF9500]",
  green: "bg-[#34C759]",
  blue: "bg-[#007AFF]",
  violet: "bg-[#AF52DE]",
} as const;

/** lucide `Bell` at `strokeWidth={NAV_STROKE}`, split in two. `body` is the
 *  dome and its rim; `clapper` is the small arc under it. */
const BELL = {
  body: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
  clapper: "M10.268 21a2 2 0 0 0 3.464 0",
} as const;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

const digitOf = (value: number) => ((value % 10) + 10) % 10;

function badgeMetrics(size: number, dot: boolean) {
  const side = size * (dot ? DOT : BADGE);
  return {
    side,
    // puts the badge on the circle so it lines up at any size
    inset: size / 2 - (ORBIT * size * Math.SQRT1_2) / 2 - side / 2,
  };
}

function useBellRing(total: number, reduced: boolean) {
  const swing = useMotionValue(0);
  const swingVelocity = useVelocity(swing);
  // clapper follows the bell's speed, so it lags behind on its own
  const clapperLag = useTransform(
    swingVelocity,
    [-CLAPPER_VELOCITY, 0, CLAPPER_VELOCITY],
    [CLAPPER_SWEEP, 0, -CLAPPER_SWEEP],
    { clamp: true },
  );
  const clapper = useSpring(clapperLag, CLAPPER_SPRING);
  const previous = useRef(total);
  const ringing = useRef<AnimationPlaybackControls | null>(null);

  const ring = useCallback(
    (strength: number) => {
      if (reduced) return;
      const moving = swing.getVelocity();
      // push it the way it is already moving so it swings harder
      const along = moving > 1 ? 1 : -1;
      ringing.current = animate(swing, 0, {
        ...SWING_SPRING,
        velocity: clamp(moving + along * IMPULSE * strength, MAX_VELOCITY),
      });
    },
    [reduced, swing],
  );

  useEffect(() => {
    const delta = total - previous.current;
    previous.current = total;
    if (delta <= 0) return;
    ring(0.7 + (0.6 * Math.min(delta, BURST)) / BURST);
  }, [total, ring]);

  useEffect(() => () => ringing.current?.stop(), []);

  return { swing, clapper, ring };
}

function BellIcon({
  side,
  swing,
  clapper,
}: {
  side: number;
  swing: MotionValue<number>;
  clapper: MotionValue<number>;
}) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={NAV_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width={side}
      height={side}
      className="shrink-0 overflow-visible"
      // the bell hangs from its crown, spinning from the middle looks wrong
      style={{ rotate: swing, transformOrigin: "50% 8.5%" }}
    >
      <path d={BELL.body} />
      <motion.path
        d={BELL.clapper}
        style={{
          rotate: clapper,
          // the clapper's own pivot is where it meets the rim, and that is the
          // top of its box — `fill-box` keeps it there at any icon size
          transformBox: "fill-box",
          transformOrigin: "50% 0%",
        }}
      />
    </motion.svg>
  );
}

// this only moves the way the count moved, so the digits roll the right way
function DigitColumn({ value, reduced }: { value: number; reduced: boolean }) {
  const position = useSpring(value, COLUMN_SPRING);
  const y = useTransform(position, (p) => `${-p * 100}%`);
  const velocity = useVelocity(position);
  const mask = useTransform(velocity, (v) => {
    const fade = Math.min(ROLL_FADE, (Math.abs(v) / ROLL_VELOCITY) * ROLL_FADE);
    return `linear-gradient(to bottom, transparent 0%, #000 ${fade}%, #000 ${100 - fade}%, transparent 100%)`;
  });

  useEffect(() => {
    const gap = value - position.get();
    // on a big jump, move it closer first so there are still digits to show
    if (Math.abs(gap) > LAG) position.jump(value - Math.sign(gap) * LAG);
    if (reduced) position.jump(value);
    else position.set(value);
  }, [value, reduced, position]);

  return (
    <motion.span
      className="relative inline-block h-[1em] overflow-hidden"
      style={{
        width: "1ch",
        maskImage: reduced ? undefined : mask,
        WebkitMaskImage: reduced ? undefined : mask,
      }}
    >
      <motion.span className="absolute inset-0" style={{ y }}>
        {Array.from({ length: WINDOW * 2 + 1 }, (_, i) => {
          const tile = value - WINDOW + i;
          return (
            <span
              key={tile}
              className="absolute inset-x-0 flex justify-center"
              style={{ top: `${tile * 100}%` }}
            >
              {digitOf(tile)}
            </span>
          );
        })}
      </motion.span>
    </motion.span>
  );
}

function CountBadge({
  total,
  max,
  size,
  color,
  dot,
  reduced,
}: {
  total: number;
  max: number;
  size: number;
  color: keyof typeof COLORS;
  dot: boolean;
  reduced: boolean;
}) {
  const { side, inset } = badgeMetrics(size, dot);
  const clamped = total > max;
  const places = clamped ? 0 : String(total).length;

  return (
    <AnimatePresence initial={false}>
      {total > 0 && (
        <motion.span
          key="badge"
          // motion does not turn layout animation off for reduced motion, so we do it here
          layout={!reduced}
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10 grid place-items-center rounded-full",
            // the ring is the button's own surface, so the badge reads as
            // sitting on the control rather than butting into the glyph
            "ring-2 ring-[var(--app-muted)] transition-[box-shadow] duration-150 group-hover:ring-[var(--app-active)]",
            COLORS[color],
          )}
          style={{
            top: inset,
            right: inset,
            height: side,
            minWidth: side,
            paddingInline: dot ? 0 : size * PAD,
            fontSize: size * FONT,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={reduced ? FADE : ENTER_SPRING}
        >
          {!dot && (
            <span
              className="flex font-semibold leading-none tracking-tight text-white"
              // digits need the same width or the columns shift
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {clamped
                ? `${max}+`
                : Array.from({ length: places }, (_, i) => {
                    const place = places - 1 - i;
                    return (
                      <DigitColumn
                        key={place}
                        value={Math.floor(total / 10 ** place)}
                        reduced={reduced}
                      />
                    );
                  })}
            </span>
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export type NotificationBellProps = Omit<
  ButtonPrimitive.Props,
  "children" | "color" | "variant" | "size"
> & {
  count?: number;
  max?: number;
  /** `count` shows the number, `dot` just marks that there is something. */
  variant?: "count" | "dot";
  /** Rendered side in px. Defaults to the 40px `size="icon"` Button is. */
  size?: number;
  color?: keyof typeof COLORS;
};

export function NotificationBell({
  count = 0,
  max = 99,
  variant = "count",
  size = 40,
  color = "red",
  className,
  style,
  onPointerEnter,
  onPointerDown,
  ...props
}: NotificationBellProps) {
  const reduced = useReducedMotion() ?? false;
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  // use the total so a weird count cannot ring the bell
  const { swing, clapper, ring } = useBellRing(total, reduced);

  return (
    <Button
      variant="secondary"
      size="icon"
      data-slot="notification-bell"
      // `group` is for the badge's ring, which tracks the button's own hover
      className={cn("group relative", className)}
      style={{ width: size, height: size, ...style }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        // touch fires this too, and there it would double up with the press
        if (event.pointerType === "mouse") ring(RING_HOVER);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        ring(RING_PRESS);
      }}
      {...props}
    >
      {/* this is also the button's label, so the count gets read out when it
          changes — no `aria-label`, which would win over it and go stale */}
      <span role="status" className="sr-only">
        {total > 0 ? `Notifications, ${total} unread` : "Notifications"}
      </span>
      <BellIcon side={size * ICON} swing={swing} clapper={clapper} />
      <CountBadge
        total={total}
        max={max}
        size={size}
        color={color}
        dot={variant === "dot"}
        reduced={reduced}
      />
    </Button>
  );
}

export default NotificationBell;
