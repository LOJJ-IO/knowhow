import type { SessionUser } from "@/lib/session";

/** Demo password for every seeded @acme.test account (no DB — in-memory roster). */
export const DEMO_PASSWORD = "knowhow-demo";

const ORG = { id: "org_acme", name: "Acme Collective" } as const;

const TEAMS = {
  marketing: { id: "team_marketing", name: "Marketing" },
  sales: { id: "team_sales", name: "Sales" },
  product: { id: "team_product", name: "Product" },
} as const;

function user(
  partial: Omit<SessionUser, "status" | "organization"> & {
    organization?: SessionUser["organization"];
  }
): SessionUser {
  return {
    status: "ACTIVE",
    organization: ORG,
    ...partial,
  };
}

/** Stable demo roster mirroring the old Prisma seed (Acme Collective). */
export const DEMO_USERS: SessionUser[] = [
  user({
    id: "user_owner",
    name: "Jordan Blake",
    email: "owner@acme.test",
    role: "OWNER",
    organizationId: ORG.id,
    teamId: null,
    team: null,
  }),
  user({
    id: "user_sarah",
    name: "Sarah Chen",
    email: "sarah.chen@acme.test",
    role: "TEAM_LEADER",
    organizationId: ORG.id,
    teamId: TEAMS.marketing.id,
    team: TEAMS.marketing,
  }),
  user({
    id: "user_mike",
    name: "Mike Ross",
    email: "mike.ross@acme.test",
    role: "MEMBER",
    organizationId: ORG.id,
    teamId: TEAMS.marketing.id,
    team: TEAMS.marketing,
  }),
  user({
    id: "user_david",
    name: "David Kim",
    email: "david.kim@acme.test",
    role: "MEMBER",
    organizationId: ORG.id,
    teamId: TEAMS.marketing.id,
    team: TEAMS.marketing,
  }),
  user({
    id: "user_priya",
    name: "Priya Anand",
    email: "priya.anand@acme.test",
    role: "TEAM_LEADER",
    organizationId: ORG.id,
    teamId: TEAMS.sales.id,
    team: TEAMS.sales,
  }),
  user({
    id: "user_leo",
    name: "Leo Martins",
    email: "leo.martins@acme.test",
    role: "MEMBER",
    organizationId: ORG.id,
    teamId: TEAMS.sales.id,
    team: TEAMS.sales,
  }),
  user({
    id: "user_wes",
    name: "Wes Okoye",
    email: "wes.okoye@acme.test",
    role: "TEAM_LEADER",
    organizationId: ORG.id,
    teamId: TEAMS.product.id,
    team: TEAMS.product,
  }),
  user({
    id: "user_nina",
    name: "Nina Patel",
    email: "nina.patel@acme.test",
    role: "MEMBER",
    organizationId: ORG.id,
    teamId: TEAMS.product.id,
    team: TEAMS.product,
  }),
  user({
    id: "user_tom",
    name: "Tom Alvarez",
    email: "tom.alvarez@acme.test",
    role: "MEMBER",
    organizationId: ORG.id,
    teamId: TEAMS.product.id,
    team: TEAMS.product,
  }),
];

export function findDemoUserByEmail(email: string): SessionUser | null {
  const normalized = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === normalized) ?? null;
}

export function findDemoUserById(id: string): SessionUser | null {
  return DEMO_USERS.find((u) => u.id === id) ?? null;
}
