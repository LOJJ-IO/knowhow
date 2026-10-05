"use client";

import { ArrowRight, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/app/badge";
import { Button } from "@/components/app/button";
import { AppDialog, FormDialog } from "@/components/app/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { editedAgo, FileIcon } from "@/components/app/file-meta";
import { FileTable } from "@/components/app/file-table";
import { NAV_STROKE } from "@/components/app/icon";
import {
  PersonChip,
  SectionHeading,
  SkeletonRows,
  Tabs,
  useUrlRequest,
  Window,
  message,
  plural,
} from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { LIBRARIAN_GROUPS, LibrarianPopup } from "@/components/app/notification-center";
import { AppPage } from "@/components/app/shell";
import { useUpdates } from "@/components/app/updates";
import { TitleAside, TitleHelp } from "@/components/app/title-aside";
import { satoshi } from "@/components/brand/fonts";
import {
  confirmTransfer,
  fetchOwnership,
  peopleById,
  planTransfer,
  resolveUnresolved,
  reverseTransfer,
  type Ownership,
  type TransferBatch,
} from "@/lib/governance";
import { cn } from "@/lib/utils";

const ago = (iso: string | null) => editedAgo(iso).replace(/^Edited /, "");

/** Ownership: every company file and who owns it, ownership moves waiting
 *  for a yes, recent moves (undoable), and files Google won't let move. */
export function OwnershipScreen() {
  const { chrome } = useSession();
  const { reloadTasks } = useUpdates();
  const org = chrome.organizationId;
  const [data, setData] = useState<Ownership | null>(null);
  const [error, setError] = useState("");
  const [team, setTeam] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [reviewBatch, setReviewBatch] = useState<TransferBatch | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchOwnership(org));
      setError("");
      // The bell's Ownership rows count the same moves.
      reloadTasks();
    } catch (e) {
      setError(message(e));
    }
  }, [org, reloadTasks]);

  useEffect(() => {
    // Loads on open; state is set only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Notifications' Librarian rows: ?review=<batch> or ?stuck=1.
  const [reviewParam, clearReview] = useUrlRequest("review");
  const [stuckParam, clearStuck] = useUrlRequest("stuck");
  useEffect(() => {
    if (!data) return;
    if (reviewParam) {
      const batch = data.batches.find((b) => b.id === reviewParam && b.status === "planned");
      // Opening the dialog the URL asked for, once data is in.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (batch) setReviewBatch(batch);
      clearReview();
    } else if (stuckParam) {
      setStuckOpen(true);
      clearStuck();
    }
  }, [data, reviewParam, stuckParam, clearReview, clearStuck]);

  const people = useMemo(() => peopleById(data?.people ?? []), [data]);
  const teamName = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.id, t.name])),
    [data],
  );
  const files = useMemo(
    () =>
      (data?.files ?? []).filter((f) =>
        team === "all" ? true : team === "org" ? !f.team_id : f.team_id === team,
      ),
    [data, team],
  );
  const recent = (data?.batches ?? []).filter((b) => b.status !== "planned").slice(0, 6);

  if (error)
    return (
      <AppPage>
        <Window>
          <EmptyState icon="verified_user" title="Couldn't load ownership" description={error} />
        </Window>
      </AppPage>
    );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function undo(batch: TransferBatch) {
    setBusy(batch.id);
    try {
      await reverseTransfer(batch.id);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const orgFiles = (data?.files ?? []).filter((f) => !f.team_id).length;
  const tabs = [
    { value: "all", label: "All", count: data?.files.length ?? 0 },
    ...(data?.teams ?? []).map((t) => ({
      value: t.id,
      label: t.name,
      count: (data?.files ?? []).filter((f) => f.team_id === t.id).length,
    })),
    ...(orgFiles ? [{ value: "org", label: "Company-wide", count: orgFiles }] : []),
  ];

  return (
    <AppPage>
      <LibrarianPopup
        kinds={LIBRARIAN_GROUPS[1].kinds}
        onAction={(task) => {
          if (task.kind === "ownership_stuck") setStuckOpen(true);
          else {
            const batch = data?.batches.find((b) => b.id === task.id);
            if (batch) setReviewBatch(batch);
          }
        }}
      />
      <TitleAside>
        <TitleHelp label="About Ownership">
          <p>
            {`${chrome.name} owns these files, so the work stays when someone leaves.`}
          </p>
        </TitleHelp>
      </TitleAside>
      <Window>
        <div className="p-8">
          {/* "Owned by the company" is the title's `?`; the moves waiting and
              the files that can't move are in Notifications under Librarian
              (Ronald 2026-10-04). */}
          <SectionHeading
            title="Files"
            action={
              data?.can_manage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!selected.size}
                  onClick={() => setMoveOpen(true)}
                >
                  {selected.size
                    ? `Move ${plural(selected.size, "file", "files")}`
                    : "Select files to move"}
                </Button>
              ) : null
            }
          />
          {data ? <Tabs className="mt-4" value={team} onChange={setTeam} options={tabs} /> : null}

          {!data ? (
            <SkeletonRows />
          ) : files.length === 0 ? (
            <EmptyState
              icon="verified_user"
              title="No company files here yet"
              description="Files show up once your librarian files them or someone makes one in Knohow."
            />
          ) : (
            <FileTable
              rows={files.map((f) => ({
                id: f.file_id,
                title: f.title,
                mimeType: f.mime_type,
                modifiedAt: f.modified_at,
                private: f.private,
                teamName: f.team_id ? (teamName.get(f.team_id) ?? "Team") : null,
                owner: f.owner_id ? people.get(f.owner_id) : undefined,
              }))}
              selected={selected}
              onToggle={data.can_manage ? toggle : undefined}
            />
          )}

          {recent.length ? (
            <>
              <SectionHeading className="mt-12" title="Recent moves" />
              <ul className="mt-4 flex flex-col gap-2">
                {recent.map((b) => {
                  const moved = b.items.filter((i) =>
                    b.status === "reversed" ? i.status === "reversed" : i.status === "transferred",
                  );
                  const to = people.get(b.items[0]?.to_id ?? "");
                  return (
                    <li
                      key={b.id}
                      className={`${satoshi.className} flex flex-wrap items-center gap-4 rounded-[18px] bg-[var(--app-muted)] px-4 py-3`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#57534e]">
                        {b.status === "reversed" ? (
                          <Undo2 size={18} strokeWidth={NAV_STROKE} />
                        ) : (
                          <ArrowRight size={18} strokeWidth={NAV_STROKE} />
                        )}
                      </span>
                      <span className="min-w-[14rem] flex-1">
                        <span className="block text-[0.9375rem] text-[#1c1917]">
                          {b.kind === "single_file_auto_own"
                            ? `${moved[0]?.title ?? "A new file"} went to its team`
                            : b.reason}
                        </span>
                        <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                          {b.status === "reversed"
                            ? `Undone ${ago(b.reversed_at)}`
                            : `${plural(moved.length, "file", "files")} to ${to?.name ?? "a new owner"} · ${ago(b.executed_at)}`}
                        </span>
                      </span>
                      {b.status === "executed" && data?.can_manage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === b.id}
                          onClick={() => void undo(b)}
                        >
                          {busy === b.id ? "Undoing…" : "Undo"}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      </Window>

      {data ? (
        <MoveDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          data={data}
          fileIds={[...selected]}
          onDone={async () => {
            setSelected(new Set());
            await refresh();
          }}
        />
      ) : null}
      {reviewBatch && data ? (
        <ReviewDialog
          batch={reviewBatch}
          data={data}
          onClose={() => setReviewBatch(null)}
          onDone={refresh}
        />
      ) : null}
      {data ? (
        <StuckDialog
          open={stuckOpen}
          onOpenChange={setStuckOpen}
          data={data}
          org={org}
          onDone={refresh}
        />
      ) : null}
    </AppPage>
  );
}

/** Pick a new owner for the selected files and move them now. */
function MoveDialog({
  open,
  onOpenChange,
  data,
  fileIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Ownership;
  fileIds: string[];
  onDone: () => Promise<void>;
}) {
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const files = data.files.filter((f) => fileIds.includes(f.file_id));
  const candidates = data.people.filter((p) => p.team_ids.length || data.files.some((f) => f.owner_id === p.id));

  async function submit() {
    if (!to) return;
    setBusy(true);
    setError("");
    try {
      const batch = await planTransfer(
        `${plural(files.length, "file", "files")} moved from Ownership`,
        files.map((f) => ({
          file_id: f.file_id,
          current_owner_member_id: f.owner_id,
          proposed_owner_member_id: to,
        })),
      );
      await confirmTransfer(batch.id);
      await onDone();
      onOpenChange(false);
      setTo(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError("");
        onOpenChange(o);
      }}
      size="sm"
      title={`Move ${plural(files.length, "file", "files")}`}
      submitLabel="Move"
      busy={busy}
      disabled={!to}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>New owner</p>
      <ul className="mt-2 flex max-h-[18rem] flex-col gap-1 overflow-y-auto pr-1">
        {candidates.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setTo(p.id)}
              aria-pressed={to === p.id}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-[#1c1917]",
                to === p.id ? "bg-[var(--app-active)]" : "hover:bg-[var(--app-muted)]",
              )}
            >
              <PersonChip person={p} size={24} />
              {p.personal ? <Badge>Personal account</Badge> : null}
            </button>
          </li>
        ))}
      </ul>
      {to && data.people.find((p) => p.id === to)?.personal ? (
        <p className={`${satoshi.className} mt-3 text-[0.8125rem] text-[#EA4335]`}>
          Google won&apos;t move ownership to a personal account. These files will be listed under
          &quot;Can&apos;t move on its own&quot; instead.
        </p>
      ) : null}
      {error ? <p className={`${satoshi.className} mt-3 text-[0.8125rem] text-[#EA4335]`}>{error}</p> : null}
    </FormDialog>
  );
}

/** A planned move, item by item, then go or not. */
function ReviewDialog({
  batch,
  data,
  onClose,
  onDone,
}: {
  batch: TransferBatch;
  data: Ownership;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const people = peopleById(data.people);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const files = new Map(data.files.map((f) => [f.file_id, f]));

  async function go() {
    setBusy(true);
    try {
      await confirmTransfer(batch.id);
      await onDone();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppDialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={batch.reason}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={() => void go()} disabled={busy}>
            {busy ? "Moving…" : `Move ${plural(batch.items.length, "file", "files")}`}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {batch.items.map((i) => (
          <li key={i.file_id} className="flex items-center gap-3 rounded-[14px] bg-[var(--app-muted)] p-3">
            <FileIcon mimeType={files.get(i.file_id)?.mime_type ?? ""} size={36} />
            <span className={`${satoshi.className} min-w-0 flex-1`}>
              <span className="block truncate text-[0.9375rem] text-[#1c1917]">{i.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-[var(--app-dim)]">
                {people.get(i.from_id ?? "")?.name ?? "Unknown"}
                <ArrowRight size={12} strokeWidth={2} />
                {people.get(i.to_id)?.name ?? "Unknown"}
              </span>
            </span>
            {i.eligible ? null : <Badge>Can&apos;t move</Badge>}
          </li>
        ))}
      </ul>
      {error ? <p className={`${satoshi.className} mt-3 text-[0.8125rem] text-[#EA4335]`}>{error}</p> : null}
    </AppDialog>
  );
}

/** Files owned by personal accounts: what to do, and a way to clear each once handled. */
function StuckDialog({
  open,
  onOpenChange,
  data,
  org,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Ownership;
  org: string;
  onDone: () => Promise<void>;
}) {
  const people = peopleById(data.people);
  const files = new Map(data.files.map((f) => [f.file_id, f]));
  const [busy, setBusy] = useState<string | null>(null);

  async function handled(id: string) {
    setBusy(id);
    try {
      await resolveUnresolved(org, id);
      await onDone();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Can't move on its own"
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      {/* No description: the rows say it (Ronald 2026-10-04). */}
      <ul className="flex flex-col gap-2">
        {data.unresolved.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-[14px] bg-[var(--app-muted)] p-3">
            <FileIcon mimeType={files.get(u.file_id)?.mime_type ?? ""} size={36} />
            <span className={`${satoshi.className} min-w-0 flex-1`}>
              <span className="block truncate text-[0.9375rem] text-[#1c1917]">{u.title}</span>
              {/* Says what to do, so the dialog needs no description
                  (Ronald 2026-10-04: "unclear still"). */}
              <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                Ask {people.get(u.owner_id ?? "")?.email ?? "its owner"} to share it
                {u.recipient_id && people.get(u.recipient_id)?.name
                  ? ` with ${people.get(u.recipient_id)?.name}`
                  : ""}
              </span>
            </span>
            <Button variant="ghost" size="sm" disabled={busy === u.id} onClick={() => void handled(u.id)}>
              {busy === u.id ? "Saving…" : "Done"}
            </Button>
          </li>
        ))}
        {data.unresolved.length === 0 ? (
          <li className={`${satoshi.className} py-6 text-center text-[0.875rem] text-[var(--app-dim)]`}>
            Nothing left to move by hand.
          </li>
        ) : null}
      </ul>
    </AppDialog>
  );
}
