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
  | { kind: "own_drive"; id: string };

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
