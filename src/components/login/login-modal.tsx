"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Book a Demo's reservation window, from first open. */
export const DEMO_RESERVED_MS = 5 * 60 * 1000;


function formatCountdown(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** "4:38 reserved" — counts down from 5:00; when it runs out it reads "Hold
 *  Expired". Plain text at the Close button's label size (no pill), top-left
 *  of the sheet. */
export function ReservedCountdown({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, DEMO_RESERVED_MS - (now - startedAt));
  const done = left === 0;

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [done]);

  const secs = Math.ceil(left / 1000);
  const label = formatCountdown(secs);

  // Only digits that changed remount (key = position + char), so only they
  // replay the pop-in. The previous label is always one second earlier;
  // changed digits stagger left → right (max stagger 2).
  const prevLabel = formatCountdown(secs + 1);
  let rank = 0;
  const digits = [...label].map((ch, i) => {
    const changed = prevLabel[i] !== ch;
    return { ch, i, stagger: changed ? Math.min(rank++, 2) : 0 };
  });

  const className = "text-[1.13569rem] font-bold text-white tabular-nums";
  if (done)
    return (
      <div role="timer" className={className}>
        Hold Expired
      </div>
    );

  return (
    <div
      role="timer"
      aria-label={`Reserved for ${label}`}
      className={className}
    >
      <span className="t-digit-group is-animating" aria-hidden>
        {digits.map(({ ch, i, stagger }) => (
          <span
            key={`${i}-${ch}`}
            className="t-digit"
            data-stagger={stagger || undefined}
          >
            {ch}
          </span>
        ))}
      </span>
      &nbsp;reserved
    </div>
  );
}

/** Log In panel's centred modal. Closed it's a thin line (border only); once
 *  `open` it grows to its content. Height can't transition to/from `auto`, so
 *  the body is measured and the shell gets an explicit px height for
 *  `.t-resize` to tween. The content is always laid out, so the growing edge
 *  reveals it. */
export function LoginModal({
  open,
  children,
}: {
  open: boolean;
  children?: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<{ border: number; full: number }>();
  const lastFull = useRef(0);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const body = bodyRef.current;
    if (!shell || !body) return;
    const measure = () => {
      const border = shell.offsetHeight - shell.clientHeight;
      const full = body.offsetHeight + border;
      // Skip the re-render when the height hasn't meaningfully changed.
      // Cal.com's embed iframe resizes internally on every interaction (date
      // pick, time select, form field focus) which fires this observer.  Each
      // setHeights call triggers a React re-render and the .t-resize CSS
      // transition tweens the modal height — the visible "blink".  A 1px
      // threshold absorbs sub-pixel jitter without hiding real content swaps.
      if (Math.abs(full - lastFull.current) < 2) return;
      lastFull.current = full;
      setHeights({ border, full });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="t-login-modal t-resize pointer-events-auto"
      style={{ height: heights && (open ? heights.full : heights.border) }}
    >
      <div ref={bodyRef} className="t-login-modal-body">
        {children}
      </div>
    </div>
  );
}
