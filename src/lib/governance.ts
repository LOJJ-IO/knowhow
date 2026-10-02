import { backendError, backendFetch } from "@/lib/backend";

/** The Ownership, Sharing, Search and Offboarding screens' data. Reads are
 *  one call per screen; writes go to the engines' own endpoints. */

export type Person = {
  id: string;
  name: string;
  email: string;
  /** A personal Google account (e.g. a contractor's Gmail). */
  personal: boolean;
  team_ids: string[];
};

export type TeamRef = { id: string; name: string };

export type CompanyFile = {
  file_id: string;
  title: string;
  mime_type: string;
  modified_at: string | null;
  owner_id: string | null;
  team_id: string | null;
  private: boolean;
};

export type TransferBatch = {
  id: string;
  reason: string;
  status: "planned" | "executed" | "reversed";
  kind: "bulk" | "single_file_auto_own";
  created_by: string | null;
  created_at: string;
  executed_at: string | null;
  reversed_at: string | null;
  items: {
    file_id: string;
    title: string;
    from_id: string | null;
    to_id: string;
    eligible: boolean;
    status: "pending" | "transferred" | "failed" | "reversed" | "skipped_ineligible";
  }[];
};

export type Unresolved = {
  id: string;
  file_id: string;
  title: string;
  owner_id: string | null;
  recipient_id: string | null;
  reason: "personal_account_owner" | "personal_account_recipient";
  created_at: string;
};

export type Ownership = {
  can_manage: boolean;
  people: Person[];
  teams: TeamRef[];
  files: CompanyFile[];
  batches: TransferBatch[];
  unresolved: Unresolved[];
};

export type SharingTeam = {
  id: string;
  name: string;
  lead_id: string | null;
  member_count: number;
  file_count: number;
  auto_own: boolean;
  owner_target_id: string | null;
  can_edit: boolean;
};

export type Suggestion = {
  id: string;
  file_id: string;
  title: string;
  mime_type: string;
  modified_at: string | null;
  web_view_link: string | null;
  recipient_ids: string[];
  created_at: string;
};

export type Sharing = {
  people: Person[];
  top_leader_ids: string[];
  teams: SharingTeam[];
  suggestions: Suggestion[];
};

export type ActivePerson = Person & {
  files_owned: number;
  leads_team_ids: string[];
  is_owner: boolean;
  can_offboard: boolean;
};

export type Offboarding = {
  people: Person[];
  teams: (TeamRef & { lead_id: string | null })[];
  active: ActivePerson[];
  history: {
    member_id: string;
    at: string;
    by_id: string | null;
    files_moved: number;
    needs_attention: number;
    to_id: string | null;
  }[];
};

export type PreviewFile = {
  file_id: string;
  title: string;
  mime_type: string;
  modified_at: string | null;
  movable: boolean;
};

export type SearchResult = {
  file_id: string;
  title: string;
  file_type: string;
  owner_email: string | null;
  modified_at: string | null;
  team_id: string | null;
  owner_id: string | null;
  company: boolean;
};

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

const org = (id: string) => `/organizations/${id}`;
const post = (body?: unknown): RequestInit => ({
  method: "POST",
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchOwnership = (orgId: string) => call<Ownership>(`${org(orgId)}/ownership`);

export const planTransfer = (
  reason: string,
  items: { file_id: string; current_owner_member_id: string | null; proposed_owner_member_id: string }[],
) => call<TransferBatch>("/transfer-batches", post({ reason, items }));

export const confirmTransfer = (batchId: string) =>
  call(`/transfer-batches/${batchId}/confirm`, post());

export const reverseTransfer = (batchId: string) =>
  call(`/transfer-batches/${batchId}/reverse`, post());

export const resolveUnresolved = (orgId: string, id: string) =>
  call(`${org(orgId)}/unresolved-ownership/${id}/resolve`, post());

export const fetchSharing = (orgId: string) => call<Sharing>(`${org(orgId)}/sharing`);

export const setAutoOwn = (orgId: string, teamId: string, on: boolean) =>
  call(`${org(orgId)}/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify({ auto_own_enabled: on }),
  });

export const decideSuggestion = (fileId: string, share: boolean) =>
  call(
    `/files/${encodeURIComponent(fileId)}/suggested-share/${share ? "confirm" : "decline"}`,
    post(),
  );

export const fetchOffboarding = (orgId: string) =>
  call<Offboarding>(`${org(orgId)}/offboarding`);

export const previewOffboarding = (orgId: string, userId: string, transferTo: string) =>
  call<{ files: PreviewFile[]; movable: boolean }>(
    `${org(orgId)}/offboarding/preview?user_id=${userId}&transfer_to=${transferTo}`,
  );

export const offboard = (userId: string, transferTo: string) =>
  call<{ unresolved_count: number; files: { action: string }[] }>(
    "/offboard",
    post({ user_id: userId, transfer_to_user_id: transferTo }),
  );

export const searchFiles = (q: string) =>
  call<{ query: string; results: SearchResult[] }>(
    `/search?q=${encodeURIComponent(q)}&limit=50`,
  );

/** id → person, for the screens that name people by id. */
export function peopleById(people: Person[]) {
  return new Map(people.map((p) => [p.id, p]));
}
