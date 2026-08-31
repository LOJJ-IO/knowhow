import { cn } from "@/lib/utils";

/**
 * Green = shared with the org owner already (the problem is solved for this
 * doc). Red = not yet shared — this is the visibility gap Knowhow exists to
 * close. See second-brain/Product/Features/FEAT-doc-visibility-dashboard.md
 */
export function DocStatusDot({ sharedWithOwner }: { sharedWithOwner: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        sharedWithOwner ? "bg-success" : "bg-destructive"
      )}
      title={sharedWithOwner ? "Shared with owner" : "Not shared with owner"}
    />
  );
}
