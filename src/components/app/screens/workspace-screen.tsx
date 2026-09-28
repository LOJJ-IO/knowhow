"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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

import { Button } from "@/components/app/button";
import { EmptyState } from "@/components/app/empty-state";
import { NAV_STROKE } from "@/components/app/icon";
import { useSession } from "@/components/app/session";
import { AppPage } from "@/components/app/shell";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { startDriveConsent, startLinkedDriveConsent } from "@/lib/backend";
import {
  fetchDrivePreview,
  fetchLinkedDrivePreviews,
  type DrivePreview,
  type DrivePreviewFile,
  type LinkedDrivePreview,
} from "@/lib/drive-preview";

/** What a Drive file's MIME type reads as, in the person's words. */
/** Google's own marks for its three editors (the New fan's PNGs); every
 *  other type keeps a line icon on a white tile. */
const GOOGLE_MARKS: Record<string, string> = {
  "application/vnd.google-apps.document": "/create/docs.png",
  "application/vnd.google-apps.spreadsheet": "/create/sheets.png",
  "application/vnd.google-apps.presentation": "/create/slides.png",
};

function describe(mime: string): { label: string; Icon: LucideIcon } {
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

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", in the largest unit that fits. */
function editedAgo(iso: string | null): string {
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

/** The Workspace screen. The librarian that sorts Drive into Knohow folders is
 *  not built, so this shows the one thing that is real: a live, unsaved look at
 *  the signed-in person's own Drive, proof the connection works. */
export function WorkspaceScreen() {
  const { chrome } = useSession();
  const [preview, setPreview] = useState<DrivePreview | null>(null);
  const [error, setError] = useState("");
  /** Personal accounts linked to you, each connected or not (ADR-0025). */
  const [linked, setLinked] = useState<LinkedDrivePreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchLinkedDrivePreviews(chrome.organizationId)
      .then((rows) => {
        if (!cancelled) setLinked(rows);
      })
      // The work Drive is the screen; a linked account failing to load
      // shouldn't take it down.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  useEffect(() => {
    let cancelled = false;
    fetchDrivePreview(chrome.organizationId)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  return (
    <AppPage>
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[32px] bg-white">
        {error ? (
          <EmptyState
            icon="folder_open"
            title="Couldn't load your Drive"
            description={error}
          />
        ) : !preview ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-8">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-[6.5rem] rounded-[20px] bg-[var(--app-muted)]"
              />
            ))}
          </div>
        ) : !preview.connected ? (
          <EmptyState
            icon="folder_open"
            title="No documents yet"
            description="Once your Google Workspace is connected, every document your teams own appears here instead of being scattered across personal drives."
            action={
              <Button size="lg" onClick={startDriveConsent}>
                Connect your Google Drive
              </Button>
            }
          />
        ) : preview.files.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="Your Drive is connected"
            description={`Signed in to Google as ${preview.connectedAs}, and there are no files in it yet.`}
          />
        ) : (
          // No heading or intro, just the files (user 2026-09-27).
          <div className="p-8">
            <FileGrid files={preview.files} className="mt-0" />
          </div>
        )}
        {linked.map((account) => (
          <LinkedAccount key={account.email} account={account} />
        ))}
      </section>
    </AppPage>
  );
}

/** A personal account linked to you (ADR-0025): its files, or a way to
 *  connect it. Shown only to you; nothing is saved or shared. */
function LinkedAccount({ account }: { account: LinkedDrivePreview }) {
  return (
    <div className="border-t border-[var(--app-border)] p-8">
      <h2
        className={`${sohne.className} text-[1.125rem] leading-[1.3] tracking-tight text-[#1c1917]`}
      >
        Personal account
      </h2>
      <p
        className={`${satoshi.className} mt-2 max-w-[34rem] text-[0.9375rem] leading-[1.55] text-[var(--app-dim)]`}
      >
        {account.connected
          ? `Reading as ${account.email}. Only you can see these, and nothing here is saved to Knohow.`
          : `${account.email} is linked to you. Connect its Drive to see its files here. Only you will see them.`}
      </p>
      {account.error ? (
        <p
          className={`${satoshi.className} mt-3 text-[0.875rem] text-[#EA4335]`}
        >
          {account.error}
        </p>
      ) : null}
      {account.connected ? (
        account.files.length ? (
          <FileGrid files={account.files} />
        ) : null
      ) : (
        <Button
          size="lg"
          className="mt-5"
          onClick={() => startLinkedDriveConsent(account.email)}
        >
          Connect this Drive
        </Button>
      )}
    </div>
  );
}

/** Recently edited files, as cards. */
function FileGrid({
  files,
  className = "mt-6",
}: {
  files: DrivePreviewFile[];
  className?: string;
}) {
  return (
    <ul className={`${className} grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3`}>
      {files.map((file) => {
        const { label, Icon } = describe(file.mimeType);
        const edited = editedAgo(file.modifiedAt);
        return (
          <li
            key={file.id}
            className="flex items-start gap-3 rounded-[20px] bg-[var(--app-muted)] p-4"
          >
            {GOOGLE_MARKS[file.mimeType] ? (
              <Image
                src={GOOGLE_MARKS[file.mimeType]}
                alt=""
                width={96}
                height={96}
                className="size-10 shrink-0"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#57534e]">
                <Icon size={20} strokeWidth={NAV_STROKE} />
              </span>
            )}
            <span className={`${satoshi.className} min-w-0`}>
              <span
                title={file.name}
                className="line-clamp-2 text-[0.9375rem] leading-[1.35] text-[#1c1917]"
              >
                {file.name}
              </span>
              <span className="mt-1 block text-[0.8125rem] text-[var(--app-dim)]">
                {label}
                {edited ? ` · ${edited}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
