"use client";

import { Toast } from "@base-ui/react/toast";
import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Library, List, Plus } from "lucide-react";

import { Button } from "@/components/app/button";
import {
  AppDialog,
  ConfirmDialog,
  FormDialog,
} from "@/components/app/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { describeFile, editedAgo, FileCard, FileIcon, FileTile } from "@/components/app/file-meta";
import { FileTable } from "@/components/app/file-table";
import { ItemMenu, type MenuAnchor, menuAnchor, RenameDialog } from "@/components/app/item-menu";
import { DEFAULT_FOLDER_COLOR, Folder, FOLDER_COLORS } from "@/components/app/folder";
import { NAV_STROKE } from "@/components/app/icon";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { LIBRARIAN_GROUPS, LibrarianPopup } from "@/components/app/notification-center";
import { Bar, Breadcrumb, Tabs, useUrlRequest, Window } from "@/components/app/screen-kit";
import { AppPage } from "@/components/app/shell";
import { TitleAside, TitleHelp } from "@/components/app/title-aside";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import {
  fetchLinkedDrivePreviews,
  type LinkedDrivePreview,
} from "@/lib/drive-preview";
import {
  confirmProposal,
  createFolder,
  declineProposal,
  decide,
  deleteFolder,
  fetchCompanyFiles,
  fetchFolder,
  fetchFolders,
  fetchProposals,
  fetchReview,
  reasonLines,
  renameFile,
  renameFolder,
  scanDrive,
  setFileInFolder,
  trashFile,
  type Candidate,
  type FolderFileItem,
  type FolderSummary,
} from "@/lib/librarian";
import { cn } from "@/lib/utils";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function without<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Workspace: where the librarian lives (ADR-0028). It goes through your
 *  Drive, you say what's company work, a lead confirms, and confirmed files
 *  land in Knohow folders. Drive itself is never reorganised. */
export function WorkspaceScreen() {
  const { chrome } = useSession();
  const { reloadTasks } = useUpdates();
  const org = chrome.organizationId;

  const [folders, setFolders] = useState<FolderSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [review, setReview] = useState<{
    total: number;
    items: Candidate[];
    awaitingConfirmation: number;
  } | null>(null);
  const [proposals, setProposals] = useState<{
    total: number;
    items: Candidate[];
  } | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [librarianError, setLibrarianError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  // A click on a folder opens it; a right click shows Rename / Delete
  // (Ronald, 2026-10-04).
  const [folderMenu, setFolderMenu] = useState<{ folder: FolderSummary; anchor: MenuAnchor } | null>(null);
  const [renaming, setRenaming] = useState<FolderSummary | null>(null);
  const [deleting, setDeleting] = useState<FolderSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openFolder(f: FolderSummary) {
    setFolderMenu(null);
    setOpenFolderId(f.id);
  }

  // Notifications' Librarian rows land here as ?librarian=sort|review and
  // open the matching dialog; the param is dropped so a reload doesn't.
  const [librarianParam, clearLibrarianParam] = useUrlRequest("librarian");
  useEffect(() => {
    if (librarianParam !== "sort" && librarianParam !== "review") return;
    // Opening a dialog the URL asked for, once per arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (librarianParam === "sort") setReviewOpen(true);
    else setProposalsOpen(true);
    clearLibrarianParam();
  }, [librarianParam, clearLibrarianParam]);
  /** Personal accounts linked to you (ADR-0025), shown only to you. */
  const [linked, setLinked] = useState<LinkedDrivePreview[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchLinkedDrivePreviews(org)
      .then((rows) => {
        if (!cancelled) setLinked(rows);
      })
      // The folders are the screen; a linked account failing to load
      // shouldn't take it down.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [org]);

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await fetchFolders(org));
      setLoadError("");
    } catch (e) {
      setLoadError(message(e));
    }
  }, [org]);

  const refreshLibrarian = useCallback(async () => {
    // Both are best-effort: a Drive that isn't connected shouldn't hide the
    // folders, only the librarian's own counts.
    const [r, p] = await Promise.allSettled([
      fetchReview(org),
      fetchProposals(org),
    ]);
    if (r.status === "fulfilled") setReview(r.value);
    if (p.status === "fulfilled") setProposals(p.value);
    // The bell's Librarian rows count the same things.
    reloadTasks();
  }, [org, reloadTasks]);

  useEffect(() => {
    // Initial load; both helpers set state only after their fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFolders();
    // What's waiting pops up as the librarian's pills (LibrarianPopup) and
    // stays in Notifications under Librarian (Ronald 2026-10-04).
    void refreshLibrarian();
  }, [refreshFolders, refreshLibrarian]);

  async function sortDrive() {
    if (scanning) return;
    setScanning(true);
    setLibrarianError("");
    setScanNote("");
    try {
      const result = await scanDrive(org);
      setScanNote(
        result.suggested
          ? `Found ${plural(result.suggested, "new file", "new files")} to sort.`
          : `Looked through ${plural(result.scanned, "file", "files")}. Nothing new to sort.`,
      );
      await refreshLibrarian();
      if (result.suggested) setReviewOpen(true);
    } catch (e) {
      setLibrarianError(message(e));
    } finally {
      setScanning(false);
    }
  }

  const toSort = review?.total ?? 0;
  const waiting = review?.awaitingConfirmation ?? 0;
  const toConfirm = proposals?.total ?? 0;

  // The title's `?` (Ronald, 2026-10-04): what Workspace is, then a line for
  // your role and one for where your librarian is. Drafted from the Help
  // screen and this screen's own lines; Ronald to edit.
  const help = (
    <TitleAside>
      <TitleHelp label="About Workspace">
        {/* One line, the crucial bit only (Ronald, 2026-10-04); what's
            waiting is the Librarian's pills. */}
        <p>Your librarian sorts your files into company folders. Your Drive is never changed.</p>
      </TitleHelp>
    </TitleAside>
  );

  if (openFolderId)
    return (
      <AppPage>
        {help}
        <Window>
          <FolderView
            org={org}
            folderId={openFolderId}
            onBack={() => {
              setOpenFolderId(null);
              void refreshFolders();
            }}
          />
        </Window>
      </AppPage>
    );

  /** "Your librarian" as a bar on the page when nothing is waiting. */
  function librarianBars() {
    return (
      <>
        <Bar
          icon={<Library size={20} strokeWidth={NAV_STROKE} />}
          title="Your librarian"
          body={
            librarianError ||
            scanNote ||
            (toSort
              ? `${plural(toSort, "file is", "files are")} waiting for you to sort.`
              : "Go through your Drive and pick out company work. Files you mark personal stay yours, and Knohow keeps nothing about them.")
          }
          error={Boolean(librarianError)}
          footnote={
            waiting
              ? `${plural(waiting, "file is", "files are")} waiting for a lead to confirm.`
              : undefined
          }
        >
          {toSort ? (
            <>
              <Button variant="secondary" onClick={() => void sortDrive()} disabled={scanning}>
                {scanning ? "Looking…" : "Look again"}
              </Button>
              <Button onClick={() => setReviewOpen(true)}>Sort {toSort}</Button>
            </>
          ) : (
            <Button onClick={() => void sortDrive()} disabled={scanning}>
              {scanning ? "Looking through your Drive…" : "Sort my Drive"}
            </Button>
          )}
        </Bar>

        {toConfirm ? (
          <Bar
            className="mt-3"
            icon={<Library size={20} strokeWidth={NAV_STROKE} />}
            title="Waiting for you"
            body={`${plural(toConfirm, "file was", "files were")} put forward as company work.`}
          >
            <Button onClick={() => setProposalsOpen(true)}>Review</Button>
          </Bar>
        ) : null}
      </>
    );
  }

  return (
    <AppPage>
      {help}
      <Window>
        <div className="p-8">
          {/* Anything waiting lives in Notifications under Librarian
              (Ronald 2026-10-04). With nothing waiting, the bar stays so
              you can still start a sort. */}
          {review && proposals && !toSort && !toConfirm ? librarianBars() : null}

          {/* Folders. */}
          <div className="mt-10 flex items-center justify-between gap-4 first:mt-0">
            <h2
              className={`${sohne.className} text-[1.125rem] leading-[1.3] tracking-tight text-[#1c1917]`}
            >
              Folders
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setNewFolderOpen(true)}>
              <Plus size={16} strokeWidth={NAV_STROKE} />
              New folder
            </Button>
          </div>

          {loadError ? (
            <EmptyState icon="folder_open" title="Couldn't load your folders" description={loadError} />
          ) : !folders ? (
            <FolderGrid>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <div className="h-[162px] w-[193px] rounded-[20px] bg-[var(--app-muted)]" />
                  <div className="h-4 w-24 rounded-full bg-[var(--app-muted)]" />
                </div>
              ))}
            </FolderGrid>
          ) : folders.length === 0 ? (
            <EmptyState
              icon="folder_open"
              title="No folders yet"
              description="Every team gets a folder of its own. Make one for anything that cuts across teams."
            />
          ) : (
            <FolderGrid>
              {folders.map((f) => (
                <div key={f.id} className="flex flex-col items-center gap-3">
                  <Folder
                    label={f.name}
                    fileNames={f.preview.map((p) => p.name)}
                    color={f.color}
                    onOpen={() => openFolder(f)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFolderMenu({ folder: f, anchor: menuAnchor(e) });
                    }}
                  />
                  <div className={`${satoshi.className} text-center`}>
                    <div className="text-[0.9375rem] text-[#1c1917]">{f.name}</div>
                    <div className="mt-0.5 text-[0.8125rem] text-[var(--app-dim)]">
                      {f.fileCount ? plural(f.fileCount, "file", "files") : "Empty"}
                      {f.teamId ? " · Team" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </FolderGrid>
          )}
        </div>
        {/* An unconnected linked account is a Pending task in Notifications,
            not a prompt here (user 2026-09-27). */}
        {linked
          .filter((account) => account.connected)
          .map((account) => (
            <LinkedAccount key={account.email} account={account} />
          ))}
      </Window>

      <LibrarianPopup
        kinds={LIBRARIAN_GROUPS[0].kinds}
        onAction={(task) =>
          task.kind === "librarian_sort" ? setReviewOpen(true) : setProposalsOpen(true)
        }
      />
      <ReviewDialog
        org={org}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        items={review?.items ?? []}
        total={toSort}
        onChanged={() => {
          void refreshLibrarian();
          void refreshFolders();
        }}
      />
      <ProposalsDialog
        org={org}
        open={proposalsOpen}
        onOpenChange={setProposalsOpen}
        items={proposals?.items ?? []}
        onChanged={() => {
          void refreshLibrarian();
          void refreshFolders();
        }}
      />
      <ItemMenu
        anchor={folderMenu?.anchor ?? null}
        canManage={folderMenu?.folder.canManage ?? false}
        onOpenChange={(o) => {
          if (!o) setFolderMenu(null);
        }}
        onRename={() => setRenaming(folderMenu!.folder)}
        onDelete={() => setDeleting(folderMenu!.folder)}
      />
      {renaming ? (
        <RenameDialog
          key={renaming.id}
          title="Rename folder"
          name={renaming.name}
          maxLength={255}
          onClose={() => setRenaming(null)}
          onRename={async (name) => {
            await renameFolder(org, renaming.id, name);
            await refreshFolders();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? "this folder"}?`}
        confirmLabel="Delete folder"
        destructive
        busy={deleteBusy}
        onConfirm={async () => {
          if (!deleting) return;
          setDeleteBusy(true);
          try {
            await deleteFolder(org, deleting.id);
            setDeleting(null);
            await refreshFolders();
          } catch (e) {
            setLoadError(message(e));
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
      <NewFolderDialog
        org={org}
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreated={() => void refreshFolders()}
      />
    </AppPage>
  );
}

/** A connected personal account linked to you (ADR-0025): its recent files.
 *  Shown only to you; nothing here is saved to Knohow. Connecting one is a
 *  Pending task in Notifications. */
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
        {`Reading as ${account.email}. Only you can see these, and nothing here is saved to Knohow.`}
      </p>
      {account.error ? (
        <p className={`${satoshi.className} mt-3 text-[0.875rem] text-[#EA4335]`}>
          {account.error}
        </p>
      ) : null}
      {account.files.length ? (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,8rem)] justify-center gap-x-8 gap-y-3">
          {account.files.map((file) => (
            <li key={file.id} className="min-w-0">
              <FileCard
                name={file.name}
                mimeType={file.mimeType}
                modifiedAt={file.modifiedAt}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}



/** The type filter inside a folder, in this order, only for types present. */
const KIND_ORDER = ["Doc", "Sheet", "Slides", "Form", "PDF", "Image", "Video", "Folder", "File"];
const KIND_PLURAL: Record<string, string> = {
  Doc: "Docs",
  Sheet: "Sheets",
  Form: "Forms",
  PDF: "PDFs",
  Image: "Images",
  Video: "Videos",
  Folder: "Folders",
  File: "Other",
};

function FolderGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] justify-items-start gap-x-4 gap-y-10 pb-4">
      {children}
    </div>
  );
}


const SUGGESTION_TEXT = {
  company: "Looks like company work",
  personal: "Looks personal",
  unsure: "Not sure",
} as const;

/** One chip, the same quiet grey as Home's "New". */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`${satoshi.className} inline-flex h-6 items-center rounded-[6px] bg-white px-2 text-[0.75rem] text-[#44403c]`}
    >
      {children}
    </span>
  );
}

function ReviewDialog({
  org,
  open,
  onOpenChange,
  items,
  total,
  onChanged,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Candidate[];
  total: number;
  onChanged: () => void;
}) {
  /** Where each file is going: starts as the librarian's guess; "Not sure"
   *  files have none until you pick. */
  const [choice, setChoice] = useState<Record<string, Label>>({});
  /** Files the backend wants a second yes on (your answer goes against what
   *  it saw), with the answer you gave. */
  const [checks, setChecks] = useState<Record<string, Label>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const where = (c: Candidate): Label | undefined =>
    choice[c.id] ?? (c.suggestion === "unsure" ? undefined : c.suggestion);
  const move = (c: Candidate, to: Label) => setChoice((m) => ({ ...m, [c.id]: to }));

  async function saveAll() {
    setSaving(true);
    setError("");
    const again: Record<string, Label> = {};
    try {
      await Promise.all(
        items.map(async (c) => {
          const label = where(c);
          if (!label) return;
          if ((await decide(org, c.id, label, false)) === "ask_again") again[c.id] = label;
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
      onChanged();
    }
    if (Object.keys(again).length) setChecks(again);
    else close();
  }

  async function confirm(c: Candidate, label: Label, again: boolean) {
    setSaving(true);
    setError("");
    try {
      await decide(org, c.id, label, again);
      setChecks((m) => without(m, c.id));
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setChoice({});
    setChecks({});
    setError("");
    onOpenChange(false);
  }

  const checking = items.filter((c) => checks[c.id]);
  const groups: { title: string; files: Candidate[]; other?: Label }[] = checking.length
    ? []
    : [
        { title: SUGGESTION_TEXT.company, files: items.filter((c) => where(c) === "company"), other: "personal" },
        { title: SUGGESTION_TEXT.personal, files: items.filter((c) => where(c) === "personal"), other: "company" },
        { title: SUGGESTION_TEXT.unsure, files: items.filter((c) => !where(c)) },
      ];

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      size="sm"
      title="Sort your Drive"
      footer={
        checking.length ? (
          <Button onClick={close}>Done</Button>
        ) : items.length ? (
          <Button onClick={() => void saveAll()} disabled={saving}>
            {saving ? "Sorting…" : "Looks right"}
          </Button>
        ) : (
          <Button onClick={close}>Done</Button>
        )
      }
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
      {items.length === 0 ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
          Nothing to sort right now.
        </p>
      ) : checking.length ? (
        // A second yes, only for the files that need it.
        <SortGroup title="Check these again">
          {checking.map((c) => {
            const label = checks[c.id];
            return (
              <SortRow key={c.id} file={c}>
                <span className={`${satoshi.className} text-[0.8125rem] text-[#1c1917]`}>
                  {label === "personal" ? "Keep it as yours?" : "Send it as company work?"}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void confirm(c, label === "personal" ? "company" : "personal", false)}
                >
                  No
                </Button>
                <Button size="xs" disabled={saving} onClick={() => void confirm(c, label, true)}>
                  Yes
                </Button>
              </SortRow>
            );
          })}
        </SortGroup>
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter((g) => g.files.length)
            .map((g) => (
              <SortGroup key={g.title} title={g.title}>
                {g.files.map((c) => (
                  <SortRow key={c.id} file={c}>
                    {g.other ? (
                      <Button size="xs" variant="outline" disabled={saving} onClick={() => move(c, g.other!)}>
                        {g.other === "personal" ? "Personal" : "Company"}
                      </Button>
                    ) : (
                      <>
                        <Button size="xs" variant="outline" disabled={saving} onClick={() => move(c, "personal")}>
                          Personal
                        </Button>
                        <Button size="xs" variant="outline" disabled={saving} onClick={() => move(c, "company")}>
                          Company
                        </Button>
                      </>
                    )}
                  </SortRow>
                ))}
              </SortGroup>
            ))}
        </div>
      )}
      {total > items.length && !checking.length ? (
        <p className={`${satoshi.className} mt-6 text-center text-[0.8125rem] text-[var(--app-dim)]`}>
          {plural(total - items.length, "more file", "more files")} after these.
        </p>
      ) : null}
    </AppDialog>
  );
}

type Label = "company" | "personal";

/** The librarian's guess, said once, over the files it covers (Ronald
 *  2026-10-02: the old per-file chips repeated it on every row). */
function SortGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={`${satoshi.className} mb-1 px-1 text-[0.8125rem] font-medium text-[var(--app-dim)]`}>
        {title}
      </h3>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

/** One file as a quiet line: small icon, name (opens it in Drive), when it
 *  was edited, and the row's one control. */
function SortRow({ file, children }: { file: Candidate; children: React.ReactNode }) {
  const edited = editedAgo(file.modifiedAt);
  return (
    <li className="flex items-center gap-3 rounded-[14px] px-1 py-2">
      <FileIcon mimeType={file.mimeType} size={32} />
      <span className={`${satoshi.className} min-w-0 flex-1`}>
        {file.webViewLink ? (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            title={file.name}
            className="block truncate text-[0.9375rem] text-[#1c1917] underline-offset-2 hover:underline"
          >
            {file.name}
          </a>
        ) : (
          <span title={file.name} className="block truncate text-[0.9375rem] text-[#1c1917]">
            {file.name}
          </span>
        )}
        {edited ? <span className="block text-[0.8125rem] text-[var(--app-dim)]">{edited}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{children}</span>
    </li>
  );
}

function ProposalsDialog({
  org,
  open,
  onOpenChange,
  items,
  onChanged,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Candidate[];
  onChanged: () => void;
}) {
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(c: Candidate, yes: boolean) {
    setBusy(c.id);
    setError("");
    try {
      if (yes) await confirmProposal(org, c.id);
      else await declineProposal(org, c.id);
      setDone((d) => ({ ...d, [c.id]: yes ? "Confirmed and filed." : "Declined." }));
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone({});
          setError("");
        }
        onOpenChange(o);
      }}
      size="sm"
      title="Confirm company work"
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
      {items.length === 0 ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
          Nothing waiting for you.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <li key={c.id}>
              <FileTile name={c.name} mimeType={c.mimeType} modifiedAt={c.modifiedAt} />
              <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
                <Chip>From {c.proposedBy?.name ?? c.proposedBy?.email ?? "a teammate"}</Chip>
                {reasonLines(c.reasons).map((r) => (
                  <Chip key={r}>{r}</Chip>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  {done[c.id] ? (
                    <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>{done[c.id]}</span>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => void act(c, false)}>
                        Decline
                      </Button>
                      <Button size="sm" disabled={busy === c.id} onClick={() => void act(c, true)}>
                        Confirm
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppDialog>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none focus:border-[#1c1917]";

function NewFolderDialog({
  org,
  open,
  onOpenChange,
  onCreated,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_FOLDER_COLOR);
  // The custom circle's colour, once one has been picked.
  const [custom, setCustom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setColor(DEFAULT_FOLDER_COLOR);
    setCustom(null);
    setError("");
  }

  return (
    <FormDialog
      open={open}
      size="sm"
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="New folder"
      submitLabel="Create"
      busy={busy}
      disabled={!name.trim()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await createFolder(org, name, color);
          onCreated();
          reset();
          onOpenChange(false);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {/* Live preview: the folder as it will sit on the grid, name under it. */}
      <div className="flex flex-col items-center gap-3 pt-2 pb-6">
        <Folder label={name} color={color} decorative />
        <div
          className={`${satoshi.className} min-h-[1.375rem] max-w-full truncate text-center text-[0.9375rem] text-[#1c1917]`}
        >
          {name.trim()}
        </div>
      </div>

      <label className={`${satoshi.className} flex flex-col gap-1.5`}>
        <span className="text-[0.875rem] text-[#1c1917]">Name</span>
        <input
          autoFocus
          type="text"
          value={name}
          maxLength={255}
          onChange={(e) => setName(e.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <div className={`${satoshi.className} mt-5 flex flex-col gap-2`}>
        <span id="new-folder-colour" className="text-[0.875rem] text-[#1c1917]">
          Colour
        </span>
        <div role="radiogroup" aria-labelledby="new-folder-colour" className="flex items-center gap-3">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.name}
              onClick={() => setColor(c.value)}
              className={cn(SWATCH_CLASS, color === c.value && SWATCH_SELECTED)}
              style={{ backgroundColor: c.value }}
            />
          ))}
          {/* Custom: the circle opens the system colour picker; once a
              colour is picked it fills the circle. */}
          <label
            className={cn(
              SWATCH_CLASS,
              "relative overflow-visible has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#1c1917]",
              custom !== null && color === custom && SWATCH_SELECTED,
            )}
            style={{
              background:
                custom ??
                "conic-gradient(#ff5e5e, #ffb84d, #f5e663, #4cc38a, #50b1fd, #8b7bff, #ff5ec4, #ff5e5e)",
            }}
            onClick={() => {
              if (custom) setColor(custom);
            }}
          >
            <input
              type="color"
              aria-label="Custom colour"
              value={custom ?? color}
              onChange={(e) => {
                setCustom(e.target.value);
                setColor(e.target.value);
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>
      {error ? <p className={`${satoshi.className} mt-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
    </FormDialog>
  );
}

const SWATCH_CLASS =
  "size-7 shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] outline-none transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]";
/** Picked: a ring with a white gap, so it reads on any colour. */
const SWATCH_SELECTED = "shadow-[0_0_0_2px_#fff,0_0_0_4px_#1c1917]";

function FolderView({
  org,
  folderId,
  onBack,
}: {
  org: string;
  folderId: string;
  onBack: () => void;
}) {
  const [folder, setFolder] = useState<{
    id: string;
    name: string;
    teamId: string | null;
    files: FolderFileItem[];
  } | null>(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kind, setKind] = useState("all");
  /** Grid of cards, or details: Ownership's columns (Ronald, 2026-10-04). */
  const [view, setView] = useState<"grid" | "details">("grid");
  /** A right click on a file: Rename / Delete / Move / Remove (Ronald,
   *  2026-10-04). */
  const [fileMenu, setFileMenu] = useState<{ file: FolderFileItem; anchor: MenuAnchor } | null>(null);
  const [moving, setMoving] = useState<FolderFileItem | null>(null);
  const [renaming, setRenaming] = useState<FolderFileItem | null>(null);
  const toasts = Toast.useToastManager();
  /** A rename or delete that failed; the folder itself is still fine. */
  const [actionError, setActionError] = useState("");

  async function trash(f: FolderFileItem) {
    setActionError("");
    try {
      await trashFile(org, f.fileId);
      toasts.add({
        type: "success",
        title: "Moved to Trash",
        description: `${f.name} can be restored from Settings for 30 days.`,
      });
      await load();
    } catch (e) {
      setActionError(message(e));
    }
  }

  async function removeFromFolder(f: FolderFileItem) {
    setActionError("");
    try {
      await setFileInFolder(org, folderId, f.fileId, false);
      await load();
    } catch (e) {
      setActionError(message(e));
    }
  }

  const load = useCallback(async () => {
    try {
      setFolder(await fetchFolder(org, folderId));
    } catch (e) {
      setError(message(e));
    }
  }, [org, folderId]);

  useEffect(() => {
    // Loads once per folder; state is set only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Coming back from Docs (a renamed file, say): load again, and the backend
  // re-reads names from Google.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [load]);

  const files = folder?.files ?? [];
  const kinds = KIND_ORDER.filter((k) => files.some((f) => describeFile(f.mimeType).label === k));
  const shown = kind === "all" ? files : files.filter((f) => describeFile(f.mimeType).label === kind);

  return (
    <div className="p-8">
      <Breadcrumb
        trail={[
          { label: "Folders", onClick: onBack },
          { label: folder?.name ?? "…" },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={`${sohne.className} text-[1.375rem] leading-[1.25] tracking-tight text-[#1c1917]`}>
            {folder?.name ?? ""}
          </h2>
          <p className={`${satoshi.className} mt-1 text-[0.875rem] text-[var(--app-dim)]`}>
            {folder
              ? `${folder.teamId ? "This team's folder. " : ""}${folder.files.length ? plural(folder.files.length, "file", "files") : "No files yet"}.`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="View" className="flex items-center gap-1">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={16} strokeWidth={NAV_STROKE} />
            </Button>
            <Button
              variant={view === "details" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Details view"
              aria-pressed={view === "details"}
              onClick={() => setView("details")}
            >
              <List size={16} strokeWidth={NAV_STROKE} />
            </Button>
          </div>
          {folder && !folder.teamId ? (
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete folder
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)} disabled={!folder}>
            <Plus size={16} strokeWidth={NAV_STROKE} />
            Add files
          </Button>
        </div>
      </div>

      {actionError ? (
        <p className={`${satoshi.className} mt-3 text-[0.875rem] text-[#EA4335]`}>{actionError}</p>
      ) : null}
      {error ? (
        <EmptyState icon="folder_open" title="Couldn't load this folder" description={error} />
      ) : !folder ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,8rem)] justify-center gap-x-8 gap-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="size-18 rounded-[12px] bg-[var(--app-muted)]" />
              <div className="h-4 w-3/4 rounded-[6px] bg-[var(--app-muted)]" />
              <div className="h-3 w-1/2 rounded-[6px] bg-[var(--app-muted)]" />
            </div>
          ))}
        </div>
      ) : folder.files.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title="This folder is empty"
          description="Files land here when a lead confirms them, or add company files yourself."
        />
      ) : (
        <>
          {kinds.length > 1 ? (
            <Tabs
              className="mt-6"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All", count: files.length },
                ...kinds.map((k) => ({
                  value: k,
                  label: KIND_PLURAL[k] ?? k,
                  count: files.filter((f) => describeFile(f.mimeType).label === k).length,
                })),
              ]}
            />
          ) : null}
          {view === "details" ? (
            <FileTable
              onRowMenu={(id, anchor) => {
                const file = shown.find((f) => f.fileId === id);
                if (file) setFileMenu({ file, anchor });
              }}
              onRowOpen={(id) => {
                const link = shown.find((f) => f.fileId === id)?.webViewLink;
                if (link) window.open(link, "_blank", "noopener,noreferrer");
              }}
              rows={shown.map((f) => ({
                id: f.fileId,
                title: f.name,
                mimeType: f.mimeType,
                modifiedAt: f.modifiedAt,
                private: f.private,
                teamName: f.teamName ?? null,
                owner: f.owner,
              }))}
            />
          ) : (
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,8rem)] justify-center gap-x-8 gap-y-3">
              {shown.map((f) => (
                <li key={f.fileId}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    // Enter / Space opens the menu under the card; a pointer
                    // right-clicks for it.
                    onClick={(e) => {
                      if (e.detail === 0) setFileMenu({ file: f, anchor: e.currentTarget });
                      // A mouse click opens the file in Google (Ronald,
                      // 2026-10-04); in the sandbox, a blank file with the
                      // same name, a new one each click.
                      else if (f.webViewLink) window.open(f.webViewLink, "_blank", "noopener,noreferrer");
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFileMenu({ file: f, anchor: menuAnchor(e) });
                    }}
                    className="block w-full min-w-0 cursor-pointer rounded-[10px] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1917]"
                  >
                    <FileCard name={f.name} mimeType={f.mimeType} modifiedAt={f.modifiedAt} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ItemMenu
        anchor={fileMenu?.anchor ?? null}
        canManage={fileMenu?.file.canManage ?? false}
        onOpenChange={(o) => {
          if (!o) setFileMenu(null);
        }}
        onRename={() => setRenaming(fileMenu!.file)}
        onDelete={() => void trash(fileMenu!.file)}
        onMove={() => setMoving(fileMenu!.file)}
        onRemove={() => void removeFromFolder(fileMenu!.file)}
      />
      {moving ? (
        <MoveFileDialog
          key={moving.fileId}
          org={org}
          fromFolderId={folderId}
          file={moving}
          onClose={() => setMoving(null)}
          onMoved={() => void load()}
        />
      ) : null}
      {renaming ? (
        <RenameDialog
          key={renaming.fileId}
          title="Rename file"
          name={renaming.name}
          maxLength={1024}
          onClose={() => setRenaming(null)}
          onRename={async (name) => {
            await renameFile(org, renaming.fileId, name);
            await load();
          }}
        />
      ) : null}
      {folder ? (
        <AddFilesDialog
          org={org}
          folderId={folder.id}
          present={new Set(folder.files.map((f) => f.fileId))}
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={() => void load()}
        />
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${folder?.name ?? "this folder"}?`}
        confirmLabel="Delete folder"
        destructive
        busy={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteFolder(org, folderId);
            setDeleteOpen(false);
            onBack();
          } catch (e) {
            setError(message(e));
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

function AddFilesDialog({
  org,
  folderId,
  present,
  open,
  onOpenChange,
  onAdded,
}: {
  org: string;
  folderId: string;
  present: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [files, setFiles] = useState<FolderFileItem[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchCompanyFiles(org)
      .then((all) => {
        if (!cancelled) setFiles(all);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, org]);

  const choices = (files ?? []).filter((f) => !present.has(f.fileId));

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPicked([]);
          setError("");
        }
        onOpenChange(o);
      }}
      size="sm"
      title="Add files"
      submitLabel={picked.length ? `Add ${picked.length}` : "Add"}
      busy={busy}
      disabled={!picked.length}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          for (const id of picked) await setFileInFolder(org, folderId, id, true);
          onAdded();
          setPicked([]);
          onOpenChange(false);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
      {!files ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>Loading…</p>
      ) : choices.length === 0 ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
          Every company file you can see is already here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {choices.map((f) => {
            const on = picked.includes(f.fileId);
            return (
              <li key={f.fileId}>
                <label className="block cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={() =>
                      setPicked((p) => (on ? p.filter((x) => x !== f.fileId) : [...p, f.fileId]))
                    }
                  />
                  <FileTile
                    name={f.name}
                    mimeType={f.mimeType}
                    modifiedAt={f.modifiedAt}
                    className={cn(
                      "outline-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-[#1c1917]",
                      on ? "bg-[var(--app-active)]" : "hover:bg-[var(--app-active)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 flex size-5 shrink-0 items-center justify-center rounded-[6px] border",
                        on ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-[#d6d1c9] bg-white",
                      )}
                    >
                      {on ? (
                        <svg viewBox="0 0 16 16" className="size-3" fill="none">
                          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                  </FileTile>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </FormDialog>
  );
}

/** Move to folder, from a file's right-click menu: pick another folder; the
 *  file goes there and leaves this one. */
function MoveFileDialog({
  org,
  fromFolderId,
  file,
  onClose,
  onMoved,
}: {
  org: string;
  fromFolderId: string;
  file: FolderFileItem;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [folders, setFolders] = useState<FolderSummary[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchFolders(org)
      .then((all) => {
        if (!cancelled) setFolders(all.filter((f) => f.id !== fromFolderId));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [org, fromFolderId]);

  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      size="sm"
      title={`Move ${file.name}`}
      submitLabel="Move"
      busy={busy}
      disabled={!picked}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!picked) return;
        setBusy(true);
        setError("");
        try {
          await setFileInFolder(org, picked, file.fileId, true);
          await setFileInFolder(org, fromFolderId, file.fileId, false);
          onMoved();
          onClose();
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
      {!folders ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>Loading…</p>
      ) : folders.length === 0 ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
          {"There's no other folder to move it to."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {folders.map((f) => (
            <li key={f.id}>
              <label
                className={cn(
                  `${satoshi.className} flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-[0.9375rem] text-[#1c1917]`,
                  picked === f.id ? "bg-[var(--app-active)]" : "hover:bg-[var(--app-muted)]",
                )}
              >
                <input
                  type="radio"
                  name="move-to"
                  checked={picked === f.id}
                  onChange={() => setPicked(f.id)}
                  className="size-4 accent-[#1c1917]"
                />
                {f.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
