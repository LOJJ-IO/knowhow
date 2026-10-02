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
};

export type FolderSummary = {
  id: string;
  name: string;
  teamId: string | null;
  fileCount: number;
  preview: FolderFileItem[];
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
};

type RawFolder = {
  id: string;
  name: string;
  team_id: string | null;
  file_count: number;
  preview: RawFile[];
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
});

const folder = (f: RawFolder): FolderSummary => ({
  id: f.id,
  name: f.name,
  teamId: f.team_id,
  fileCount: f.file_count,
  preview: f.preview.map(file),
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

export async function createFolder(org: string, name: string) {
  return folder(
    await call<RawFolder>(`${base(org)}/folders`, {
      method: "POST",
      body: JSON.stringify({ name }),
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
) {
  return call<{ id: string; name: string; url: string | null }>(
    `${base(org)}/documents`,
    { method: "POST", body: JSON.stringify({ kind }) },
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
