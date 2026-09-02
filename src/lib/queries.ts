import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";

type DocumentWithOwner = Prisma.DocumentGetPayload<{ include: { owner: true } }>;

export async function getOrgTeams(organizationId: string) {
  return prisma.team.findMany({
    where: { organizationId },
    include: {
      leader: true,
      members: { where: { status: "ACTIVE" } },
      policy: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getOrgOwner(organizationId: string) {
  return prisma.user.findFirstOrThrow({
    where: { organizationId, role: "OWNER" },
  });
}

export async function getTeamWithRoster(organizationId: string, teamId: string) {
  return prisma.team.findFirstOrThrow({
    where: { id: teamId, organizationId },
    include: {
      leader: true,
      members: { orderBy: { name: "asc" } },
      policy: true,
    },
  });
}

export type TeamDocumentColumns = Record<"DOC" | "SHEET" | "SLIDE", DocumentWithOwner[]>;

/** Powers the owner/leader dashboard's three-column recent-documents view. */
export async function getTeamDocumentsByType(
  organizationId: string,
  teamId: string
): Promise<TeamDocumentColumns> {
  const docs = await prisma.document.findMany({
    where: { organizationId, teamId },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    DOC: docs.filter((d) => d.type === "DOC"),
    SHEET: docs.filter((d) => d.type === "SHEET"),
    SLIDE: docs.filter((d) => d.type === "SLIDE"),
  };
}

type Viewer = { id: string; role: string; teamId: string | null };

/**
 * What a viewer is allowed to see besides their own documents:
 * - owner: anything shared up to them, plus org-wide broadcasts;
 * - leader: their team's leader-shared docs, org-level docs shared with all
 *   leaders (teamId null), and broadcasts;
 * - member: their team's surfaced docs and broadcasts.
 */
function visibilityWhere(viewer: Viewer): Prisma.DocumentWhereInput {
  if (viewer.role === "OWNER") {
    return { OR: [{ sharedWithOwner: true }, { sharedWithEveryone: true }] };
  }
  if (viewer.role === "TEAM_LEADER") {
    return {
      OR: [
        { teamId: viewer.teamId, sharedWithLeader: true },
        { teamId: null, sharedWithLeader: true },
        { sharedWithEveryone: true },
      ],
    };
  }
  return {
    OR: [
      {
        teamId: viewer.teamId,
        OR: [{ sharedWithLeader: true }, { sharedWithOwner: true }],
      },
      { sharedWithEveryone: true },
    ],
  };
}

/** Powers the personal "Shared With You" dashboard for a member/leader. */
export async function getDocumentsSharedWithUser(
  organizationId: string,
  user: Viewer
): Promise<TeamDocumentColumns> {
  const docs = await prisma.document.findMany({
    where: {
      organizationId,
      ownerId: { not: user.id },
      ...visibilityWhere(user),
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return {
    DOC: docs.filter((d) => d.type === "DOC"),
    SHEET: docs.filter((d) => d.type === "SHEET"),
    SLIDE: docs.filter((d) => d.type === "SLIDE"),
  };
}

/** The viewer's own recent documents, with team (folder) context. */
export async function getMyDocuments(organizationId: string, userId: string) {
  return prisma.document.findMany({
    where: { organizationId, ownerId: userId },
    include: { team: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export type DocSearchHit = Prisma.DocumentGetPayload<{
  include: { owner: true; team: true };
}>;

/** Org-wide title search, scoped to what the viewer may see (plus their own). */
export async function searchDocuments(
  organizationId: string,
  viewer: Viewer,
  query: string
): Promise<DocSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  return prisma.document.findMany({
    where: {
      organizationId,
      title: { contains: q },
      OR: [{ ownerId: viewer.id }, visibilityWhere(viewer)],
    },
    include: { owner: true, team: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

export type FolderRoutingEntry = {
  folder: string;
  teamName: string | null;
  docCount: number;
  latest: { title: string; ownerName: string; createdAt: Date } | null;
};

/**
 * Powers the owner dashboard's "Drive auto-filing" panel: one Drive folder
 * per team (plus Company for org-level docs), with counts and the last file
 * routed there.
 */
export async function getFolderRouting(
  organizationId: string
): Promise<FolderRoutingEntry[]> {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    include: {
      documents: {
        include: { owner: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const orgDocs = await prisma.document.findMany({
    where: { organizationId, teamId: null },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
  });

  const toEntry = (
    folder: string,
    teamName: string | null,
    docs: { title: string; owner: { name: string }; createdAt: Date }[]
  ): FolderRoutingEntry => ({
    folder,
    teamName,
    docCount: docs.length,
    latest: docs[0]
      ? {
          title: docs[0].title,
          ownerName: docs[0].owner.name,
          createdAt: docs[0].createdAt,
        }
      : null,
  });

  return [
    toEntry("Company", null, orgDocs),
    ...teams.map((t) => toEntry(t.name, t.name, t.documents)),
  ];
}

export async function getRecentActivity(organizationId: string, take = 30) {
  return prisma.activityEvent.findMany({
    where: { organizationId },
    include: { actor: true, target: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}
