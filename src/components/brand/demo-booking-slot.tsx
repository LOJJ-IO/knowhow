import { LoadingMark } from "@/components/brand/loading-mark";

/** The booking step's fixed slot: the Cal embed's footprint, and the reason
 *  the modal grows exactly once (an auto-height child tweened twice — first
 *  to the placeholder, then to Cal's own height). Height matches what Cal
 *  reports for `month_view` at this width, so the embed fills it with no
 *  dead space to sit off-centre in. Also rendered on its own while the Cal
 *  chunk loads, with the turning Knohow mark centred inside it. */
function DemoBookingSlot({ children }: { children?: React.ReactNode }) {
  return (
    <div className="t-demo-booking">
      {children ?? <DemoBookingLoading />}
    </div>
  );
}

/** The mark, centred in the slot, while Cal isn't ready. */
function DemoBookingLoading() {
  return (
    <LoadingMark
      label="Loading the calendar"
      className="absolute top-1/2 left-1/2 w-40 -translate-x-1/2 -translate-y-1/2"
    />
  );
}

export { DemoBookingSlot, DemoBookingLoading };
