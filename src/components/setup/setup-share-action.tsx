"use client";

import { CopyField } from "@/components/ui/copy-field";

/** A setup link to share. Copying doesn't move the screen on; the screen's
 *  own Continue does that. Inset 2.5% each side like the other setup fields. */
export function SetupCopyLink({ url, label }: { url: string; label: string }) {
  return (
    <div className="mx-[2.5%]">
      <CopyField label={label} value={url} showLabel={false} />
    </div>
  );
}
