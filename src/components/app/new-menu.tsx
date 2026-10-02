"use client";

import { Menu } from "@base-ui/react/menu";
import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";

import { useSession } from "@/components/app/session";
import { satoshi } from "@/components/brand/fonts";
import { createDocument } from "@/lib/librarian";
import { cn } from "@/lib/utils";

/** The topbar's New button opened up: make a blank Google Doc, Sheet or Slide.
 *
 *  Minimal slice (user 2026-09-29) — the file is created as the org through the
 *  backend, filed in the person's team folder, and opened in a new tab. Upload
 *  and the share-with form are the fuller flow, still to come, so the fan icon
 *  on the button shows Upload but the menu doesn't offer it yet. */
type Kind = "doc" | "sheet" | "slide";

const ITEMS: { kind: Kind; label: string; src: string }[] = [
  { kind: "doc", label: "Document", src: "/create/docs.png" },
  { kind: "sheet", label: "Spreadsheet", src: "/create/sheets.png" },
  { kind: "slide", label: "Presentation", src: "/create/slides.png" },
];

/** Google's own "make a blank file" shortcuts, used as a failsafe (user
 *  2026-09-29): if the backend can't create the org-owned, folder-filed file,
 *  the button still gives you a working blank file — created in whatever Google
 *  account the browser is signed into, so it isn't filed or tracked by Knohow. */
const NEW_FILE_URLS: Record<Kind, string> = {
  doc: "https://docs.new",
  sheet: "https://sheets.new",
  slide: "https://slides.new",
};

export function NewMenu({ children }: { children: ReactNode }) {
  const { chrome } = useSession();
  const org = chrome.organizationId;
  const [busy, setBusy] = useState<string | null>(null);

  async function create(kind: Kind) {
    if (busy) return;
    setBusy(kind);
    // Open the tab now, on the click, so the browser doesn't block it as a
    // pop-up after the await; point it at the file once we have a URL.
    const tab = window.open("", "_blank");
    const go = (url: string) =>
      tab ? tab.location.assign(url) : window.location.assign(url);
    try {
      const doc = await createDocument(org, kind);
      // Backend made and filed the file; open it. If it somehow returned no
      // link, still give the person a blank file via Google's shortcut.
      go(doc.url ?? NEW_FILE_URLS[kind]);
    } catch {
      // Failsafe: the backend couldn't create it, so fall back to Google's own
      // blank-file shortcut rather than leaving the click dead.
      go(NEW_FILE_URLS[kind]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger render={children as React.ReactElement} />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="isolate z-[450]">
          <Menu.Popup
            className={cn(
              satoshi.className,
              "app-modal w-[15rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none",
            )}
          >
            <Menu.GroupLabel className="px-4 pt-3 pb-1 text-[0.8125rem] text-[var(--app-dim)]">
              Create new
            </Menu.GroupLabel>
            {ITEMS.map((item) => (
              <Menu.Item
                key={item.kind}
                closeOnClick={false}
                disabled={busy !== null}
                onClick={() => void create(item.kind)}
                className="mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[highlighted]:bg-[var(--app-muted)]"
              >
                <Image src={item.src} alt="" width={40} height={40} className="size-5 shrink-0" />
                <span className="text-[0.9375rem] font-medium text-[#1c1917]">{item.label}</span>
                {busy === item.kind ? (
                  <span className="ml-auto text-[0.8125rem] text-[var(--app-dim)]">Opening…</span>
                ) : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
