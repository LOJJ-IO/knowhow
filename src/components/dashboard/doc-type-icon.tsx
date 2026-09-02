import { FileText, Sheet as SheetIcon, Presentation } from "lucide-react";

import { cn } from "@/lib/utils";

/** Google-Workspace-colored file icons, matching the deck: Docs blue,
 * Sheets green, Slides yellow. */
const TYPE_META = {
  DOC: { icon: FileText, chip: "bg-gblue" },
  SHEET: { icon: SheetIcon, chip: "bg-ggreen" },
  SLIDE: { icon: Presentation, chip: "bg-gyellow" },
} as const;

export type DocTypeKey = keyof typeof TYPE_META;

export function DocTypeIcon({
  type,
  className,
}: {
  type: DocTypeKey;
  className?: string;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-white",
        meta.chip,
        className
      )}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}
