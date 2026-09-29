"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ExternalLink, Library, Plus, X } from "lucide-react";

import { Button } from "@/components/app/button";
import {
  AppDialog,
  ConfirmDialog,
  FormDialog,
} from "@/components/app/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { FileTile } from "@/components/app/file-meta";
import { Folder } from "@/components/app/folder";
import { NAV_STROKE } from "@/components/app/icon";
import { useSession } from "@/components/app/session";
import { AppPage } from "@/components/app/shell";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
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
  scanDrive,
  setFileInFolder,
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

/** Workspace: where the librarian lives (ADR-0022). It goes through your
 *  Drive, you say what's company work, a lead confirms, and confirmed files
 *  land in Knohow folders. Drive itself is never reorganised. */
export function WorkspaceScreen() {
  const { chrome } = useSession();
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
  }, [org]);

  useEffect(() => {
    // Initial load; both helpers set state only after their fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFolders();
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

  if (openFolderId)
    return (
      <AppPage>
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

  const toSort = review?.total ?? 0;
  const waiting = review?.awaitingConfirmation ?? 0;
  const toConfirm = proposals?.total ?? 0;

  return (
    <AppPage>
      <Window>
        <div className="p-8">
          <Breadcrumb trail={[{ label: "Folders" }]} />
          {/* The librarian. */}
          <Bar
            className="mt-4"
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

          {/* Folders. */}
          <div className="mt-10 flex items-center justify-between gap-4">
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
                    label={`Open ${f.name}`}
                    fileNames={f.preview.map((p) => p.name)}
                    onOpen={() => setOpenFolderId(f.id)}
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
      </Window>

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
      <NewFolderDialog
        org={org}
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreated={() => void refreshFolders()}
      />
    </AppPage>
  );
}

/** Where you are in Workspace: Folders › this folder. Every segment but the
 *  last is a button back to that level. The topbar already says "Workspace",
 *  so the trail starts at Folders. */
function Breadcrumb({
  trail,
}: {
  trail: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className={`${satoshi.className} flex items-center gap-1 text-[0.875rem]`}>
      {trail.map((seg, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {seg.onClick && !last ? (
              <button
                type="button"
                onClick={seg.onClick}
                className="cursor-pointer rounded-[6px] px-1 py-0.5 text-[var(--app-dim)] outline-none hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-[#1c1917]"
              >
                {seg.label}
              </button>
            ) : (
              <span className={cn("px-1 py-0.5", last ? "text-[#1c1917]" : "text-[var(--app-dim)]")}>
                {seg.label}
              </span>
            )}
            {last ? null : (
              <ChevronRight size={14} strokeWidth={NAV_STROKE} className="text-[var(--app-dim)]" />
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** The screen's one white window, as on Home. */
function Window({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[32px] bg-white">
      {children}
    </section>
  );
}

function FolderGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] justify-items-center gap-x-4 gap-y-10 pb-4">
      {children}
    </div>
  );
}

/** A muted strip with an icon tile, a line of text and its actions. */
function Bar({
  icon,
  title,
  body,
  footnote,
  error,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footnote?: string;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-[24px] bg-[var(--app-muted)] p-5",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#57534e]">
        {icon}
      </span>
      <div className={`${satoshi.className} min-w-[14rem] flex-1`}>
        <div className={`${sohne.className} text-[1rem] tracking-tight text-[#1c1917]`}>
          {title}
        </div>
        <p
          className={cn(
            "mt-0.5 text-[0.875rem] leading-[1.5]",
            error ? "text-[#b42318]" : "text-[var(--app-dim)]",
          )}
        >
          {body}
        </p>
        {footnote ? (
          <p className="mt-0.5 text-[0.8125rem] text-[var(--app-dim)]">{footnote}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
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
  const [done, setDone] = useState<Record<string, string>>({});
  const [askAgain, setAskAgain] = useState<Record<string, "company" | "personal">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function answer(c: Candidate, label: "company" | "personal", again = false) {
    setBusy(c.id);
    setError("");
    try {
      const result = await decide(org, c.id, label, again);
      if (result === "ask_again") {
        setAskAgain((a) => ({ ...a, [c.id]: label }));
        return;
      }
      setAskAgain((a) => without(a, c.id));
      setDone((d) => ({
        ...d,
        [c.id]:
          result === "personal"
            ? "Kept as yours. Knohow won't keep anything about it."
            : result === "confirmed"
              ? "Added to your company files."
              : "Sent to your lead to confirm.",
      }));
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const left = items.filter((c) => !done[c.id]).length;

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone({});
          setAskAgain({});
          setError("");
        }
        onOpenChange(o);
      }}
      size="lg"
      title="Sort your Drive"
      description="Say which files are company work. A lead confirms before anything becomes company property."
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#b42318]`}>{error}</p> : null}
      {items.length === 0 ? (
        <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
          Nothing to sort right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const reasons = reasonLines(c.reasons);
            const again = askAgain[c.id];
            return (
              <li key={c.id}>
                <FileTile name={c.name} mimeType={c.mimeType} modifiedAt={c.modifiedAt}>
                  {c.webViewLink ? (
                    <a
                      href={c.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${c.name} in Google Drive`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--app-dim)] outline-none hover:bg-white hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-[#1c1917]"
                    >
                      <ExternalLink size={16} strokeWidth={NAV_STROKE} />
                    </a>
                  ) : null}
                </FileTile>
                <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
                  <Chip>{SUGGESTION_TEXT[c.suggestion]}</Chip>
                  {reasons.map((r) => (
                    <Chip key={r}>{r}</Chip>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    {done[c.id] ? (
                      <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
                        {done[c.id]}
                      </span>
                    ) : again ? (
                      <>
                        <span className={`${satoshi.className} text-[0.875rem] text-[#1c1917]`}>
                          {again === "personal"
                            ? "This looks like company work. Keep it as yours?"
                            : "This looks personal. Send it as company work?"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === c.id}
                          onClick={() => setAskAgain((a) => without(a, c.id))}
                        >
                          Go back
                        </Button>
                        <Button size="sm" disabled={busy === c.id} onClick={() => void answer(c, again, true)}>
                          Yes
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={c.suggestion === "personal" ? "default" : "outline"}
                          disabled={busy === c.id}
                          onClick={() => void answer(c, "personal")}
                        >
                          Personal
                        </Button>
                        <Button
                          size="sm"
                          variant={c.suggestion === "company" ? "default" : "outline"}
                          disabled={busy === c.id}
                          onClick={() => void answer(c, "company")}
                        >
                          Company
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {total > items.length && left === 0 ? (
        <p className={`${satoshi.className} mt-4 text-center text-[0.875rem] text-[var(--app-dim)]`}>
          {plural(total - items.length, "more file", "more files")} after these. Close and open again to keep going.
        </p>
      ) : null}
    </AppDialog>
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
      size="lg"
      title="Confirm company work"
      description="Your team put these forward as company files. Confirming files them in their team's folder."
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#b42318]`}>{error}</p> : null}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setName("");
          setError("");
        }
        onOpenChange(o);
      }}
      title="New folder"
      description="For work that cuts across teams. Files stay where they are in Drive."
      submitLabel="Create"
      busy={busy}
      disabled={!name.trim()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await createFolder(org, name);
          onCreated();
          setName("");
          onOpenChange(false);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
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
      {error ? <p className={`${satoshi.className} mt-3 text-[0.875rem] text-[#b42318]`}>{error}</p> : null}
    </FormDialog>
  );
}

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
  const [removing, setRemoving] = useState<string | null>(null);

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

  async function remove(fileId: string) {
    setRemoving(fileId);
    try {
      await setFileInFolder(org, folderId, fileId, false);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setRemoving(null);
    }
  }

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

      {error ? (
        <EmptyState icon="folder_open" title="Couldn't load this folder" description={error} />
      ) : !folder ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[4.75rem] rounded-[20px] bg-[var(--app-muted)]" />
          ))}
        </div>
      ) : folder.files.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title="This folder is empty"
          description="Files land here when a lead confirms them, or add company files yourself."
        />
      ) : (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {folder.files.map((f) => (
            <li key={f.fileId}>
              <FileTile name={f.name} mimeType={f.mimeType} modifiedAt={f.modifiedAt}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${f.name} from this folder`}
                  disabled={removing === f.fileId}
                  onClick={() => void remove(f.fileId)}
                  className="-mt-1 -mr-1 hover:bg-white"
                >
                  <X size={16} strokeWidth={NAV_STROKE} />
                </Button>
              </FileTile>
            </li>
          ))}
        </ul>
      )}

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
        description="The files stay in Drive and in Knohow. Only this grouping goes."
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
      size="lg"
      title="Add files"
      description="Company files you can see. A file can sit in more than one folder."
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
      {error ? <p className={`${satoshi.className} mb-3 text-[0.875rem] text-[#b42318]`}>{error}</p> : null}
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
