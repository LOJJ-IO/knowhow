export type DocType = "DOC" | "SHEET" | "SLIDE";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "TEAM_LEADER" | "MEMBER";
  status: "ACTIVE" | "OFFBOARDED";
  organizationId: string;
  teamId: string | null;
};

export type DocumentWithOwner = {
  id: string;
  title: string;
  type: DocType;
  createdAt: Date;
  ownerId: string;
  teamId: string | null;
  organizationId: string;
  sharedWithLeader: boolean;
  sharedWithOwner: boolean;
  sharedWithEveryone: boolean;
  owner: UserRow;
};

export type TeamWithRoster = {
  id: string;
  name: string;
  organizationId: string;
  leaderId: string | null;
  leader: UserRow | null;
  members: UserRow[];
  policy: {
    autoShareWithLeader: boolean;
    autoShareWithOwner: boolean;
  } | null;
};

export type TeamDocumentColumns = Record<DocType, DocumentWithOwner[]>;

export type DocSearchHit = DocumentWithOwner & {
  team: { id: string; name: string } | null;
};

export type FolderRoutingEntry = {
  folder: string;
  teamName: string | null;
  docCount: number;
  latest: { title: string; ownerName: string; createdAt: Date } | null;
};

export type ActivityEventRow = {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  actor: UserRow | null;
  target: UserRow | null;
};

const emptyColumns = (): TeamDocumentColumns => ({ DOC: [], SHEET: [], SLIDE: [] });

export async function getOrgTeams(_organizationId: string): Promise<TeamWithRoster[]> {
  return [];
}

export async function getOrgOwner(_organizationId: string): Promise<UserRow> {
  throw new Error("Database unavailable — Prisma has been removed.");
}

export async function getTeamWithRoster(
  _organizationId: string,
  _teamId: string
): Promise<TeamWithRoster> {
  throw new Error("Database unavailable — Prisma has been removed.");
}

export async function getTeamDocumentsByType(
  _organizationId: string,
  _teamId: string
): Promise<TeamDocumentColumns> {
  return emptyColumns();
}

type Viewer = { id: string; role: string; teamId: string | null };

export async function getDocumentsSharedWithUser(
  _organizationId: string,
  _user: Viewer
): Promise<TeamDocumentColumns> {
  return emptyColumns();
}

export async function getMyDocuments(_organizationId: string, _userId: string) {
  return [] as (DocumentWithOwner & { team: { id: string; name: string } | null })[];
}

export async function searchDocuments(
  _organizationId: string,
  _viewer: Viewer,
  _query: string
): Promise<DocSearchHit[]> {
  return [];
}

export async function getFolderRouting(
  _organizationId: string
): Promise<FolderRoutingEntry[]> {
  return [];
}

export async function getRecentActivity(
  _organizationId: string,
  _take = 30
): Promise<ActivityEventRow[]> {
  return [];
}
