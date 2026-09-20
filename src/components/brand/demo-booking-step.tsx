"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { DemoBookingSlot } from "@/components/brand/demo-booking-slot";
import { cancelDemoLead, readDemoResumeToken } from "@/lib/demo-lead";

/** The user's Cal.com booking link (their snippet, 2026-09-20). */
const CAL_NAMESPACE = "15min";
const CAL_LINK = "knohow-demo/15min";

/** The screen after the segment/size steps: Cal.com booking embed.
 *  `onBooked` cancels the abandoned-recovery email when a slot is booked. */
export function DemoBookingStep({ onBooked }: { onBooked?: () => void }) {
  const [ready, setReady] = useState(false);

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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onBooked]);

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
