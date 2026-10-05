import { backendError, backendFetch } from "@/lib/backend";

/** The librarian and Knohow folders (ADR-0028). Titles on candidates and
 *  proposals are read live from Google by the backend; nothing here stores
 *  them. */

export type Suggestion = "company" | "personal" | "unsure";

export type Candidate = {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  modifiedAt: string | null;
  webViewLink: string | null;
  suggestion: Suggestion;
  reasons: Record<string, number>;
  proposedBy?: { id: string; name: string | null; email: string | null };
};

export type FolderFileItem = {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedAt: string;
  /** Opens the file in Google; in the sandbox, a blank file with the same
   *  name (Ronald, 2026-10-04). Null when there's nothing to open. */
  webViewLink: string | null;
  /** Only on a folder's own files (`fetchFolder`), for the details view. */
  owner?: { name: string; email: string; personal: boolean } | null;
  teamName?: string | null;
  private?: boolean;
  /** You may rename / delete it (its owner, its team's lead, the owner, a
   *  Super Admin). */
  canManage?: boolean;
};

export type FolderSummary = {
  id: string;
  name: string;
  teamId: string | null;
  /** "#rrggbb", or null for the default blue. */
  color: string | null;
  fileCount: number;
  preview: FolderFileItem[];
  /** Rename / delete; never for a team's folder. */
  canManage: boolean;
};

type RawCandidate = {
  id: string;
  file_id: string;
  name: string;
  mime_type: string;
  modified_at: string | null;
  web_view_link: string | null;
  suggestion: Suggestion;
  reasons: Record<string, number>;
  proposed_by?: { id: string; name: string | null; email: string | null };
};

type RawFile = {
  file_id: string;
  name: string;
  mime_type: string;
  modified_at: string;
  web_view_link?: string | null;
  owner?: { name: string; email: string; personal: boolean } | null;
  team_name?: string | null;
  private?: boolean;
  can_manage?: boolean;
};

type RawFolder = {
  id: string;
  name: string;
  team_id: string | null;
  color: string | null;
  file_count: number;
  preview: RawFile[];
  can_manage: boolean;
};

const candidate = (c: RawCandidate): Candidate => ({
  id: c.id,
  fileId: c.file_id,
  name: c.name,
  mimeType: c.mime_type,
  modifiedAt: c.modified_at,
  webViewLink: c.web_view_link,
  suggestion: c.suggestion,
  reasons: c.reasons,
  proposedBy: c.proposed_by,
});

const file = (f: RawFile): FolderFileItem => ({
  fileId: f.file_id,
  name: f.name,
  mimeType: f.mime_type,
  modifiedAt: f.modified_at,
  webViewLink: f.web_view_link ?? null,
  owner: f.owner,
  teamName: f.team_name,
  private: f.private,
  canManage: f.can_manage,
});

const folder = (f: RawFolder): FolderSummary => ({
  id: f.id,
  name: f.name,
  teamId: f.team_id,
  color: f.color,
  fileCount: f.file_count,
  preview: f.preview.map(file),
  canManage: f.can_manage,
});

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await backendFetch(path, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!res.ok) throw new Error(await backendError(res));
  return (await res.json()) as T;
}

const base = (org: string) => `/organizations/${org}`;

export async function scanDrive(org: string) {
  return call<{ scanned: number; suggested: number; already_known: number }>(
    `${base(org)}/librarian/scan`,
    { method: "POST" },
  );
}

export async function fetchReview(org: string) {
  const body = await call<{
    total: number;
    items: RawCandidate[];
    awaiting_confirmation: number;
  }>(`${base(org)}/librarian/review`);
  return {
    total: body.total,
    items: body.items.map(candidate),
    awaitingConfirmation: body.awaiting_confirmation,
  };
}

export type DecisionResult = "ask_again" | "personal" | "proposed" | "confirmed";

export async function decide(
  org: string,
  candidateId: string,
  label: "company" | "personal",
  confirmedAgain = false,
): Promise<DecisionResult> {
  const body = await call<{ result: DecisionResult }>(
    `${base(org)}/librarian/candidates/${candidateId}/decision`,
    {
      method: "POST",
      body: JSON.stringify({ label, confirmed_again: confirmedAgain }),
    },
  );
  return body.result;
}

export async function fetchProposals(org: string) {
  const body = await call<{ total: number; items: RawCandidate[] }>(
    `${base(org)}/librarian/proposals`,
  );
  return { total: body.total, items: body.items.map(candidate) };
}

export async function confirmProposal(org: string, candidateId: string) {
  return call<{ file_id: string; folder_id: string | null }>(
    `${base(org)}/librarian/proposals/${candidateId}/confirm`,
    { method: "POST" },
  );
}

export async function declineProposal(org: string, candidateId: string) {
  await call(`${base(org)}/librarian/proposals/${candidateId}/decline`, {
    method: "POST",
  });
}

export async function fetchFolders(org: string): Promise<FolderSummary[]> {
  const body = await call<{ folders: RawFolder[] }>(`${base(org)}/folders`);
  return body.folders.map(folder);
}

export async function fetchFolder(org: string, folderId: string) {
  const body = await call<{
    id: string;
    name: string;
    team_id: string | null;
    files: RawFile[];
  }>(`${base(org)}/folders/${folderId}`);
  return {
    id: body.id,
    name: body.name,
    teamId: body.team_id,
    files: body.files.map(file),
  };
}

export async function createFolder(org: string, name: string, color: string) {
  return folder(
    await call<RawFolder>(`${base(org)}/folders`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),
  );
}

export async function deleteFolder(org: string, folderId: string) {
  await call(`${base(org)}/folders/${folderId}`, { method: "DELETE" });
}

export async function setFileInFolder(
  org: string,
  folderId: string,
  fileId: string,
  present: boolean,
) {
  await call(
    `${base(org)}/folders/${folderId}/files/${encodeURIComponent(fileId)}`,
    { method: present ? "PUT" : "DELETE" },
  );
}

/** The topbar's New button: make a blank Google Doc/Sheet/Slide as the org.
 *  Returns the new file's link so the caller can open it. */
export async function createDocument(
  org: string,
  kind: "doc" | "sheet" | "slide" | "form",
  name?: string,
  teamIds?: string[],
) {
  return call<{ id: string; name: string; url: string | null; team_ids: string[] }>(
    `${base(org)}/documents`,
    {
      method: "POST",
      body: JSON.stringify({ kind, name: name || null, team_ids: teamIds ?? null }),
    },
  );
}

export async function fetchCompanyFiles(org: string) {
  const body = await call<{ files: RawFile[] }>(`${base(org)}/company-files`);
  return body.files.map(file);
}

/** Why the librarian thinks what it thinks, in the person's words. */
export function reasonLines(reasons: Record<string, number>): string[] {
  const lines: string[] = [];
  const n = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  if (reasons.coworkers_shared)
    lines.push(
      `Shared with ${n(reasons.coworkers_shared, "coworker", "coworkers")}`,
    );
  if (reasons.domain_shared) lines.push("Shared with your whole organization");
  if (reasons.edited_by_coworker) lines.push("Last edited by a coworker");
  if (reasons.personal_contacts_shared)
    lines.push(
      `Shared only with ${n(reasons.personal_contacts_shared, "personal account", "personal accounts")}`,
    );
  return lines;
}

export async function renameFolder(org: string, folderId: string, name: string) {
  await call(`${base(org)}/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** Renames the file in Google Drive itself. */
export async function renameFile(org: string, fileId: string, name: string) {
  await call(`${base(org)}/company-files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** Into the owner's Drive Trash (ADR-0010); Settings' Trash restores it. */
export async function trashFile(org: string, fileId: string) {
  await call(`${base(org)}/company-files/${encodeURIComponent(fileId)}/trash`, {
    method: "POST",
  });
}

export async function restoreFile(org: string, fileId: string) {
  await call(`${base(org)}/company-files/${encodeURIComponent(fileId)}/restore`, {
    method: "POST",
  });
}

export type TrashedFile = FolderFileItem & {
  trashedAt: string;
  /** When Google empties it for good. */
  goneAt: string;
  trashedBy: string | null;
};

export async function fetchTrash(org: string): Promise<TrashedFile[]> {
  const body = await call<{
    files: (RawFile & { trashed_at: string; gone_at: string; trashed_by: string | null })[];
  }>(`${base(org)}/trash`);
  return body.files.map((f) => ({
    ...file(f),
    trashedAt: f.trashed_at,
    goneAt: f.gone_at,
    trashedBy: f.trashed_by,
  }));
}

export type LogEntry = {
  id: string;
  action: string;
  actor: string | null;
  subject: string | null;
  at: string;
};

/** Settings' Logs: the org's audit log, newest first. Owner / Super Admin
 *  only; anyone else gets a 403. */
export async function fetchLog(org: string): Promise<LogEntry[]> {
  return (await call<{ entries: LogEntry[] }>(`${base(org)}/audit/log`)).entries;
}
