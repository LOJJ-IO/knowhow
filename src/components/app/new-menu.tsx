"use client";

import { Menu } from "@base-ui/react/menu";
import { Toast } from "@base-ui/react/toast";
import { Check } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { FormDialog, MODAL_SWAP_MS } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { TeamIcon } from "@/components/identity/team-icon";
import { SetupField } from "@/components/setup/shell";
import { DotLine } from "@/components/app/dot-line";
import { createDocument } from "@/lib/librarian";
import { cn } from "@/lib/utils";

/** The topbar's New button opened up: make a blank Google Doc, Sheet, Slide
 *  or Form.
 *
 *  Minimal slice (user 2026-09-29) — the file is created as the org through the
 *  backend, filed in the person's team folder, and opened in a new tab. Form
 *  joined 2026-10-02 (Ronald) and took Upload's place on the button's fan;
 *  Upload and the share-with form are the fuller flow, still to come.
 *
 *  Named and placed first (Ronald, 2026-10-04): picking a type opens a small
 *  dialog for the file's name and, when there's more than one to choose,
 *  its teams. Anyone picks among their own teams; the owner among every
 *  team, with All teams. Once made, a toast says where it went and the
 *  team's Notifications show it. */
type Kind = "doc" | "sheet" | "slide" | "form";

const ITEMS: { kind: Kind; label: string; src: string; untitled: string }[] = [
  {
    kind: "doc",
    label: "Document",
    src: "/create/docs.png",
    untitled: "Untitled document",
  },
  {
    kind: "sheet",
    label: "Spreadsheet",
    src: "/create/sheets.png",
    untitled: "Untitled spreadsheet",
  },
  {
    kind: "slide",
    label: "Presentation",
    src: "/create/slides.png",
    untitled: "Untitled presentation",
  },
  {
    kind: "form",
    label: "Form",
    src: "/create/forms.png",
    untitled: "Untitled form",
  },
];

/** Google's own "make a blank file" shortcuts, used as a failsafe (user
 *  2026-09-29): if the backend can't create the org-owned, folder-filed file,
 *  the button still gives you a working blank file — created in whatever Google
 *  account the browser is signed into, so it isn't filed or tracked by Knohow. */
const NEW_FILE_URLS: Record<Kind, string> = {
  doc: "https://docs.google.com/document/create",
  sheet: "https://docs.google.com/spreadsheets/create",
  slide: "https://docs.google.com/presentation/create",
  form: "https://docs.google.com/forms/create",
};

/** The `create` links take a title, so the fallback file keeps the name typed
 *  in the dialog (Ronald, 2026-10-04); docs.new can't. */
function newFileUrl(kind: Kind, name: string): string {
  return name
    ? `${NEW_FILE_URLS[kind]}?${new URLSearchParams({ title: name })}`
    : NEW_FILE_URLS[kind];
}

export function NewMenu({ children }: { children: ReactNode }) {
  const { me, chrome } = useSession();
  const { overview, refresh } = useUpdates();
  const toasts = Toast.useToastManager();
  const org = chrome.organizationId;
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Kind | null>(null);
  /** Kept after close so the dialog's title doesn't blank mid-fade. */
  const [shown, setShown] = useState<Kind>("doc");
  /** Bumped on each open: a fresh dialog, so no name or ticks carry over. */
  const [opens, setOpens] = useState(0);

  const isOwner = chrome.viewer.isOwner;
  const teams = (overview?.teams ?? []).filter(
    (t) => isOwner || t.memberIds.includes(me.id),
  );

  async function create(kind: Kind, name: string, teamIds: string[]) {
    if (busy) return;
    setBusy(kind);
    // Open the tab now, on the click, so the browser doesn't block it as a
    // pop-up after the await; point it at the file once we have a URL.
    const tab = window.open("", "_blank");
    const go = (url: string) =>
      tab ? tab.location.assign(url) : window.location.assign(url);
    try {
      const doc = await createDocument(org, kind, name, teamIds);
      // Backend made and filed the file; open it. If it somehow returned no
      // link, still give the person a blank file via Google's shortcut.
      go(doc.url ?? newFileUrl(kind, name));
      setPending(null);
      // Your own action, but asked for (Ronald, 2026-10-04): say it was
      // made, and re-read so Notifications lists it now.
      // The file opens in another tab: hold the toast until this tab is
      // back in front, so it isn't gone before anyone sees it.
      const toast = () =>
        toasts.add({
          type: "success",
          title: `${ITEMS.find((i) => i.kind === kind)!.label} created`,
          // Who and where, in the dot style; several teams read
          // "Multiple teams" (Ronald 2026-10-04). No file name.
          description: (
            <DotLine
              tone="dark"
              person={{ identity: me.email, name: me.display_name ?? me.email }}
              teams={doc.team_ids.flatMap((id) =>
                (overview?.teams ?? []).filter((t) => t.id === id),
              )}
            />
          ),
        });
      if (document.visibilityState === "visible" && document.hasFocus())
        toast();
      else {
        const show = () => {
          window.removeEventListener("focus", show);
          toast();
        };
        window.addEventListener("focus", show);
      }
      refresh();
    } catch {
      // Failsafe: the backend couldn't create it, so fall back to Google's own
      // blank-file shortcut rather than leaving the click dead.
      go(newFileUrl(kind, name));
      setPending(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger render={children as React.ReactElement} />
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          className="isolate z-[450]"
        >
          <Menu.Popup
            className={cn(
              satoshi.className,
              "app-modal w-[15rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none",
            )}
          >
            <Menu.Group>
              <Menu.GroupLabel className="px-4 pt-3 pb-1 text-[0.8125rem] text-[var(--app-dim)]">
                Create new
              </Menu.GroupLabel>
              {ITEMS.map((item) => (
                <Menu.Item
                  key={item.kind}
                  disabled={busy !== null}
                  onClick={() => {
                    setShown(item.kind);
                    setOpens((n) => n + 1);
                    setPending(item.kind);
                  }}
                  className="group mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[highlighted]:bg-[var(--app-muted)]"
                >
                  <Image
                    src={item.src}
                    alt=""
                    width={40}
                    height={40}
                    // The lifetime dropdown's calendar move (Manage teams →
                    // "7 days"): tilt and grow with an overshoot, on hover or
                    // keyboard highlight (Ronald, 2026-10-02).
                    className="size-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[highlighted]:-rotate-12 group-data-[highlighted]:scale-110 motion-reduce:transition-none"
                  />
                  <span className="text-[0.9375rem] font-medium text-[#1c1917]">
                    {item.label}
                  </span>
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      <NewFileDialog
        key={opens}
        open={pending !== null}
        item={ITEMS.find((i) => i.kind === shown)!}
        teams={teams}
        allTeams={isOwner}
        busy={busy !== null}
        onClose={() => setPending(null)}
        onCreate={(name, teamIds) => void create(shown, name, teamIds)}
      />
    </Menu.Root>
  );
}

type PickableTeam = { id: string; name: string };

/** The file's name, then its teams when there's a choice to make. One team
 *  (or none) skips the picker and files it there (Ronald, 2026-10-04). Rows
 *  are Sharing's "Add a team or person" rows. */
function NewFileDialog({
  open,
  item,
  teams,
  allTeams,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  item: (typeof ITEMS)[number];
  teams: PickableTeam[];
  /** The owner: offer All teams. */
  allTeams: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, teamIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const choosing = teams.length > 1;

  useEffect(() => {
    if (!open) return;
    // Focus once the dialog has opened, like New team.
    const timer = window.setTimeout(
      () => inputRef.current?.focus(),
      MODAL_SWAP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const everyTeam =
    teams.length > 0 && teams.every((t) => picked.includes(t.id));

  const row = (
    key: string,
    on: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string,
  ) => (
    <li key={key}>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onClick}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2 text-left text-[0.9375rem] text-[#1c1917] outline-none hover:bg-[var(--app-muted)] focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 ${on ? "bg-[var(--app-muted)]" : ""}`}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          aria-hidden
          className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-[#d9d9de]"}`}
        >
          {on ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      </button>
    </li>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`New ${item.label.toLowerCase()}`}
      size="sm"
      submitLabel="Create"
      busy={busy}
      disabled={choosing && picked.length === 0}
      onSubmit={(e) => {
        e.preventDefault();
        // Keep the list's order, so the first ticked-in-the-list team is the
        // file's own team.
        const ids = choosing
          ? teams.filter((t) => picked.includes(t.id)).map((t) => t.id)
          : teams.map((t) => t.id);
        onCreate(name.trim(), ids);
      }}
    >
      <div className={`${satoshi.className} flex flex-col gap-5 py-2`}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.875rem] text-[#1c1917]">Name</span>
          <SetupField
            inputRef={inputRef}
            className="rounded-[10px]"
            placeholder={item.untitled}
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {choosing ? (
          <section className="flex flex-col gap-1">
            <span className="text-[0.875rem] font-medium text-[#1c1917]">
              Which team is it for?
            </span>
            {/* A gap between the rows, so ticked ones read as separate pills (Ronald 2026-10-04). */}
            <ul className="flex flex-col gap-1">
              {allTeams
                ? row(
                    "all",
                    everyTeam,
                    () => setPicked(everyTeam ? [] : teams.map((t) => t.id)),
                    <span
                      aria-hidden
                      className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[var(--app-muted)] text-[0.75rem] font-medium text-[var(--app-dim)]"
                    >
                      {teams.length}
                    </span>,
                    "All teams",
                  )
                : null}
              {teams.map((t) =>
                row(
                  t.id,
                  picked.includes(t.id),
                  () => toggle(t.id),
                  <TeamIcon name={t.name} size={30} />,
                  t.name,
                ),
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </FormDialog>
  );
}
