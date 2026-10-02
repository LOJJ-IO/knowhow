import {
  ClipboardList,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Image as ImageIcon,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { NAV_STROKE } from "@/components/app/icon";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

/** What a Drive file's MIME type reads as, in the person's words. */
export function describeFile(mime: string): { label: string; Icon: LucideIcon } {
  if (mime === "application/vnd.google-apps.folder")
    return { label: "Folder", Icon: Folder };
  if (mime === "application/vnd.google-apps.document")
    return { label: "Doc", Icon: FileText };
  if (mime === "application/vnd.google-apps.spreadsheet")
    return { label: "Sheet", Icon: FileSpreadsheet };
  if (mime === "application/vnd.google-apps.presentation")
    return { label: "Slides", Icon: Presentation };
  if (mime === "application/vnd.google-apps.form")
    return { label: "Form", Icon: ClipboardList };
  if (mime === "application/pdf") return { label: "PDF", Icon: FileText };
  if (mime.startsWith("image/")) return { label: "Image", Icon: ImageIcon };
  if (mime.startsWith("video/")) return { label: "Video", Icon: Video };
  return { label: "File", Icon: File };
}

/** Google's own marks for its three editors (the New fan's PNGs). */
const GOOGLE_MARKS: Record<string, string> = {
  "application/vnd.google-apps.document": "/create/docs.png",
  "application/vnd.google-apps.spreadsheet": "/create/sheets.png",
  "application/vnd.google-apps.presentation": "/create/slides.png",
};

/** A file's icon on a white tile: Google's mark for Docs, Sheets and
 *  Slides, a line icon for everything else. One look across the app. */
export function FileIcon({ mimeType, size = 40 }: { mimeType: string; size?: number }) {
  const mark = GOOGLE_MARKS[mimeType];
  const { Icon } = describeFile(mimeType);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[12px] bg-white text-[#57534e]"
      style={{ width: size, height: size }}
    >
      {mark ? (
        <Image src={mark} alt="" width={64} height={64} style={{ width: size * 0.62, height: size * 0.62 }} />
      ) : (
        <Icon size={Math.round(size / 2)} strokeWidth={NAV_STROKE} />
      )}
    </span>
  );
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "Edited 3 days ago", in the largest unit that fits. */
export function editedAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps)
    if (Math.abs(seconds) >= size)
      return `Edited ${RELATIVE.format(Math.round(seconds / size), unit)}`;
  return "Edited just now";
}

/** One file as the app draws it: white icon tile, name, "Doc · Edited …".
 *  `children` is the row's trailing controls, if any. */
export function FileTile({
  name,
  mimeType,
  modifiedAt,
  className,
  children,
}: {
  name: string;
  mimeType: string;
  modifiedAt?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const { label } = describeFile(mimeType);
  const edited = editedAgo(modifiedAt);
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[20px] bg-[var(--app-muted)] p-4",
        className,
      )}
    >
      <FileIcon mimeType={mimeType} />
      <span className={`${satoshi.className} min-w-0 flex-1`}>
        <span
          title={name}
          className="line-clamp-2 text-[0.9375rem] leading-[1.35] text-[#1c1917]"
        >
          {name}
        </span>
        <span className="mt-1 block text-[0.8125rem] text-[var(--app-dim)]">
          {label}
          {edited ? ` · ${edited}` : ""}
        </span>
      </span>
      {children}
    </div>
  );
}
