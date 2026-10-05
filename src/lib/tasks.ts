import { backendError, backendFetch } from "@/lib/backend";

/** What the signed-in member still has to do (ADR-0026), in the order the
 *  backend returns them. Each is only sent to someone who can act on it. */
export type TaskPerson = {
  id: string;
  email: string;
  displayName: string | null;
};

export type Task =
  | {
      kind: "join_request";
      id: string;
      team: { id: string; name: string | null };
      person: TaskPerson | null;
    }
  | { kind: "owner_claim"; id: string; person: TaskPerson | null }
  | { kind: "no_owner"; id: string }
  | { kind: "no_super_admin"; id: string }
  | { kind: "company_drive"; id: string }
  | { kind: "own_drive"; id: string }
  /** A linked personal account whose Drive isn't connected (ADR-0025). */
  | { kind: "linked_drive"; id: string; email: string }
  /** The librarian's own section (Ronald 2026-10-04): your files it wants
   *  sorted, and teammates' proposals you can confirm. Counts only. */
  | { kind: "librarian_sort"; id: string; count: number }
  | { kind: "librarian_review"; id: string; count: number }
  /** Ownership, Sharing and Offboarding prompts, also under Librarian
   *  (Ronald 2026-10-04). */
  | {
      kind: "ownership_review";
      id: string;
      reason: string;
      count: number;
      toName: string | null;
    }
  | { kind: "ownership_stuck"; id: string; count: number }
  | { kind: "share_suggestions"; id: string; count: number }
  /** A report, not a to-do: cleared in the dialog. `id` is the audit entry. */
  | {
      kind: "offboarded";
      id: string;
      at: string | null;
      personName: string | null;
      byName: string | null;
      toName: string | null;
      filesMoved: number;
      needsAttention: number;
    };

const LIBRARIAN_KINDS = new Set<Task["kind"]>([
  "librarian_sort",
  "librarian_review",
  "ownership_review",
  "ownership_stuck",
  "share_suggestions",
  "offboarded",
]);

export const isLibrarianTask = (t: Task) => LIBRARIAN_KINDS.has(t.kind);

type RawPerson = { id: string; email: string; display_name: string | null } | null;

function person(raw: RawPerson): TaskPerson | null {
  return raw
    ? { id: raw.id, email: raw.email, displayName: raw.display_name }
    : null;
}

export async function fetchTasks(organizationId: string): Promise<Task[]> {
  const res = await backendFetch(`/organizations/${organizationId}/tasks`);
  if (!res.ok) throw new Error(await backendError(res));
  const body = (await res.json()) as (Record<string, unknown> & {
    kind: Task["kind"];
    id: string;
  })[];
  return body.map((t) => {
    if (t.kind === "join_request")
      return {
        kind: t.kind,
        id: t.id,
        team: t.team as { id: string; name: string | null },
        person: person(t.person as RawPerson),
      };
    if (t.kind === "owner_claim")
      return { kind: t.kind, id: t.id, person: person(t.person as RawPerson) };
    if (t.kind === "linked_drive")
      return { kind: t.kind, id: t.id, email: t.email as string };
    if (
      t.kind === "librarian_sort" ||
      t.kind === "librarian_review" ||
      t.kind === "ownership_stuck" ||
      t.kind === "share_suggestions"
    )
      return { kind: t.kind, id: t.id, count: t.count as number };
    if (t.kind === "ownership_review")
      return {
        kind: t.kind,
        id: t.id,
        reason: t.reason as string,
        count: t.count as number,
        toName: (t.to_name as string | null) ?? null,
      };
    if (t.kind === "offboarded")
      return {
        kind: t.kind,
        id: t.id,
        at: (t.at as string | null) ?? null,
        personName: (t.person_name as string | null) ?? null,
        byName: (t.by_name as string | null) ?? null,
        toName: (t.to_name as string | null) ?? null,
        filesMoved: t.files_moved as number,
        needsAttention: t.needs_attention as number,
      };
    return { kind: t.kind, id: t.id } as Task;
  });
}

async function post(path: string, body: unknown) {
  const res = await backendFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await backendError(res));
}

export function decideJoinRequest(
  organizationId: string,
  requestId: string,
  approve: boolean,
) {
  return post(
    `/organizations/${organizationId}/team-join-requests/${requestId}`,
    { approve },
  );
}

export function decideOwnerClaim(organizationId: string, approve: boolean) {
  return post(`/organizations/${organizationId}/owner-claim/decision`, {
    approve,
  });
}
