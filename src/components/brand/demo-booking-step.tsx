"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { DemoBookingSlot } from "@/components/brand/demo-booking-slot";

/** The user's Cal.com booking link (their snippet, 2026-09-20). */
const CAL_NAMESPACE = "15min";
const CAL_LINK = "knohow-demo/15min";

/** The screen after the segment step: the user's Cal.com booking embed
 *  (`knohow-demo/15min`, namespace + config from the snippet they supplied).
 *  Inline, not the snippet's popup button — this screen *is* the embed.
 *  Its own chunk, loaded on demand from `landing-hero.tsx` (Cal is heavy and
 *  only this screen needs it). `LoginModal`'s ResizeObserver + `.t-resize`
 *  tween the modal to the slot's height in one move (the area bounces, not
 *  the embed). The modal drops its own surface, widens and takes the plain
 *  button radius for this screen — see `.t-demo-booking` and
 *  `.t-login-modal:has(.t-demo-booking)` in `globals.css`. No heading or
 *  copy — none has been written. */
export function DemoBookingStep() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      if (cancelled) return;
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DemoBookingSlot>
      {ready ? (
        <Cal
          namespace={CAL_NAMESPACE}
          calLink={CAL_LINK}
          config={{ layout: "month_view", useSlotsViewOnSmallScreen: "true" }}
          style={{ width: "100%", height: "100%", overflow: "hidden" }}
        />
      ) : undefined}
    </DemoBookingSlot>
  );
}
