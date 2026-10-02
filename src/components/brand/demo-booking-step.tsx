"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import {
  DemoBookingLoading,
  DemoBookingSlot,
} from "@/components/brand/demo-booking-slot";
import { cancelDemoLead, readDemoResumeToken } from "@/lib/demo-lead";

/** The user's Cal.com booking link (their snippet, 2026-09-20). */
const CAL_NAMESPACE = "15min";
const CAL_LINK = "knohow-demo/15min";

/** The screen after the segment/size steps: Cal.com booking embed.
 *  `onBooked` cancels the abandoned-recovery email when a slot is booked. */
export function DemoBookingStep({ onBooked }: { onBooked?: () => void }) {
  const [ready, setReady] = useState(false);
  /** Cal's booking page has rendered inside the iframe. */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      if (cancelled) return;
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          const token = readDemoResumeToken();
          if (token) void cancelDemoLead(token, "booked");
          onBooked?.();
        },
      });
      // Cal draws its own spinner while the booking page loads; it stays
      // hidden behind the turning mark until the page is actually there.
      for (const action of ["linkReady", "linkFailed"] as const) {
        cal("on", {
          action,
          callback: () => {
            if (!cancelled) setLoaded(true);
          },
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onBooked]);

  return (
    <DemoBookingSlot>
      {ready ? (
        <div
          className="h-full w-full transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
        >
          <Cal
            namespace={CAL_NAMESPACE}
            calLink={CAL_LINK}
            config={{ layout: "month_view", useSlotsViewOnSmallScreen: "true" }}
            style={{ width: "100%", height: "100%", overflow: "hidden" }}
          />
        </div>
      ) : null}
      {loaded ? null : <DemoBookingLoading />}
    </DemoBookingSlot>
  );
}
