/** Book a Demo lead API + sessionStorage for the resume token. */

const TOKEN_KEY = "knohow_demo_resume_token";

export type DemoLeadStep =
  | "names"
  | "email"
  | "website"
  | "segment"
  | "size"
  | "booking";

export type DemoLeadPayload = {
  email: string;
  first_name?: string;
  last_name?: string;
  website?: string | null;
  segment?: string | null;
  other_text?: string | null;
  team_size?: string | null;
  step?: DemoLeadStep;
};

export type DemoLead = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  website: string | null;
  segment: string | null;
  other_text: string | null;
  team_size: string | null;
  step: DemoLeadStep;
  resume_token: string;
  recovery_sent: boolean;
  cancelled: boolean;
  booked: boolean;
};

function backendUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_API_URL;
}

export function readDemoResumeToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function writeDemoResumeToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearDemoResumeToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function parseJson(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && typeof detail[0]?.msg === "string"
          ? detail[0].msg
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as DemoLead;
}

export async function upsertDemoLead(
  payload: DemoLeadPayload,
): Promise<DemoLead | null> {
  const base = backendUrl();
  if (!base) return null;
  const res = await fetch(`${base}/demo-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const lead = await parseJson(res);
  writeDemoResumeToken(lead.resume_token);
  return lead;
}

export async function patchDemoLead(
  token: string,
  payload: Omit<DemoLeadPayload, "email">,
): Promise<DemoLead | null> {
  const base = backendUrl();
  if (!base) return null;
  const res = await fetch(`${base}/demo-leads/by-token/${encodeURIComponent(token)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function touchDemoLead(token: string): Promise<void> {
  const base = backendUrl();
  if (!base) return;
  await fetch(`${base}/demo-leads/by-token/${encodeURIComponent(token)}/touch`, {
    method: "POST",
  });
}

export async function cancelDemoLead(
  token: string,
  reason: "reopen" | "cta" | "booked",
): Promise<void> {
  const base = backendUrl();
  if (!base) return;
  await fetch(`${base}/demo-leads/by-token/${encodeURIComponent(token)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function fetchDemoResume(token: string): Promise<DemoLead | null> {
  const base = backendUrl();
  if (!base) return null;
  const res = await fetch(
    `${base}/demo-leads/resume/${encodeURIComponent(token)}`,
  );
  const lead = await parseJson(res);
  writeDemoResumeToken(lead.resume_token);
  return lead;
}

/** Map a lead's saved step into DemoForm UI state. */
export function leadToFormState(lead: DemoLead) {
  const fieldStep =
    lead.step === "names" ? 0 : lead.step === "email" ? 1 : 2;
  const phase =
    lead.step === "booking"
      ? ("booking" as const)
      : lead.step === "size"
        ? ("size" as const)
        : lead.step === "segment"
          ? ("segment" as const)
          : ("fields" as const);
  return {
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email,
    website: lead.website ?? "",
    segment: lead.segment,
    other: lead.other_text ?? "",
    size: lead.team_size,
    fieldStep,
    phase,
    resumeToken: lead.resume_token,
  };
}
