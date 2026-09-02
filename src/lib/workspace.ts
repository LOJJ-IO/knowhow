import { randomBytes } from "crypto";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const MOCK_APPS = ["Google Drive", "Gmail", "Slack", "Zoom"];

type OnboardInput = {
  organizationId: string;
  teamId: string;
  actorId: string;
  name: string;
  email: string;
  role: "TEAM_LEADER" | "MEMBER";
};

export type OnboardResult = {
  userId: string;
  appsGranted: string[];
  autoShareEnabled: boolean;
};

/**
 * Onboards a person onto a team: creates their account, applies the team's
 * sharing policy, and writes the activity events that make the automation
 * visible. No real Google API calls happen here (see ADR-0001) — this is the
 * seam that gets swapped for the real Admin SDK integration later.
 */
export async function onboardPerson(input: OnboardInput): Promise<OnboardResult> {
  const { organizationId, teamId, actorId, name, email, role } = input;

  const team = await prisma.team.findFirstOrThrow({
    where: { id: teamId, organizationId },
    include: { policy: true },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`${email} is already onboarded.`);
  }

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      organizationId,
      teamId,
      name,
      email,
      passwordHash,
      role,
      status: "ACTIVE",
    },
  });

  const autoShareEnabled = Boolean(
    team.policy?.autoShareWithLeader || team.policy?.autoShareWithOwner
  );

  await prisma.activityEvent.create({
    data: {
      organizationId,
      type: "ONBOARDED",
      actorId,
      targetId: user.id,
      message: `${name} onboarded to ${team.name} as ${role === "TEAM_LEADER" ? "team leader" : "member"} — granted access to ${MOCK_APPS.join(", ")}.`,
    },
  });

  if (autoShareEnabled) {
    await prisma.activityEvent.create({
      data: {
        organizationId,
        type: "DOC_AUTO_SHARED",
        actorId,
        targetId: user.id,
        message: `Auto-share enabled for ${name}'s future documents (policy: ${team.name}).`,
      },
    });
  }

  return { userId: user.id, appsGranted: MOCK_APPS, autoShareEnabled };
}

export type ShareChoice = "POLICY" | "LEADER" | "OWNER" | "EVERYONE" | "PRIVATE";

export type CreateDocumentInput = {
  organizationId: string;
  actorId: string;
  title: string;
  type: "DOC" | "SHEET" | "SLIDE";
  share: ShareChoice;
};

export type CreateDocumentResult = {
  documentId: string;
  folder: string;
  sharedWith: string[];
};

/**
 * Creates a document as the actor, applies the sharing choice (or the team's
 * auto-share policy), and "files" it into the right Drive folder — the team's
 * folder, or the Company folder for org-level docs. Like onboarding, the real
 * Drive API call is mocked (ADR-0001); this function is the seam.
 */
export async function createAndFileDocument(
  input: CreateDocumentInput
): Promise<CreateDocumentResult> {
  const { organizationId, actorId, title, type, share } = input;

  const actor = await prisma.user.findFirstOrThrow({
    where: { id: actorId, organizationId },
    include: { team: { include: { policy: true, leader: true } } },
  });
  const owner = await prisma.user.findFirstOrThrow({
    where: { organizationId, role: "OWNER" },
  });

  const policy = actor.team?.policy;
  const sharedWithEveryone = share === "EVERYONE";
  const sharedWithOwner =
    sharedWithEveryone ||
    share === "OWNER" ||
    (share === "POLICY" && (policy?.autoShareWithOwner ?? true));
  const sharedWithLeader =
    sharedWithEveryone ||
    share === "LEADER" ||
    (share === "POLICY" && (policy?.autoShareWithLeader ?? true));

  const folder = actor.team?.name ?? "Company";

  const doc = await prisma.document.create({
    data: {
      organizationId,
      teamId: actor.teamId,
      ownerId: actor.id,
      title,
      type,
      sharedWithOwner,
      sharedWithLeader,
      sharedWithEveryone,
    },
  });

  const sharedWith: string[] = [];
  if (sharedWithEveryone) {
    sharedWith.push("everyone in the organization");
  } else {
    const leader = actor.team?.leader;
    if (sharedWithLeader && leader && leader.id !== actor.id) {
      sharedWith.push(`${leader.name} (team leader)`);
    }
    if (sharedWithLeader && !actor.team) {
      sharedWith.push("all team leaders");
    }
    if (sharedWithOwner && owner.id !== actor.id) {
      sharedWith.push(`${owner.name} (owner)`);
    }
  }

  await prisma.activityEvent.create({
    data: {
      organizationId,
      type: "DOC_AUTO_SHARED",
      actorId: actor.id,
      message:
        `"${title}" created by ${actor.name} — filed in Drive › ${folder}` +
        (sharedWith.length > 0
          ? `, auto-shared with ${sharedWith.join(" and ")}.`
          : ". Not shared with anyone yet."),
    },
  });

  return { documentId: doc.id, folder, sharedWith };
}

export type OffboardResult = {
  userId: string;
  docsTransferred: number;
  accessRevoked: string[];
};

/**
 * Offboards a person: reassigns everything they own to their team leader
 * (or the org owner if they had no leader / were the leader themselves),
 * revokes their mock app access, and logs every step to the activity feed.
 */
export async function offboardPerson(
  organizationId: string,
  userId: string,
  actorId: string
): Promise<OffboardResult> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, organizationId },
    include: { team: { include: { leader: true } }, ledTeam: true },
  });

  const owner = await prisma.user.findFirstOrThrow({
    where: { organizationId, role: "OWNER" },
  });

  const successor =
    user.team?.leaderId && user.team.leaderId !== user.id
      ? user.team.leaderId
      : owner.id;

  const ownedDocs = await prisma.document.findMany({
    where: { ownerId: userId },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: "OFFBOARDED" },
    }),
    prisma.document.updateMany({
      where: { ownerId: userId },
      data: { ownerId: successor, sharedWithOwner: true, sharedWithLeader: true },
    }),
    // Vacate any team-leader seat so the org chart doesn't point at an offboarded user.
    prisma.team.updateMany({
      where: { leaderId: userId },
      data: { leaderId: null },
    }),
  ]);

  await prisma.activityEvent.create({
    data: {
      organizationId,
      type: "OFFBOARDED",
      actorId,
      targetId: userId,
      message: `${user.name} offboarded from ${user.team?.name ?? "the organization"}.`,
    },
  });

  for (const doc of ownedDocs) {
    await prisma.activityEvent.create({
      data: {
        organizationId,
        type: "DOC_REASSIGNED",
        actorId,
        targetId: userId,
        message: `"${doc.title}" reassigned from ${user.name} to their successor.`,
      },
    });
  }

  await prisma.activityEvent.create({
    data: {
      organizationId,
      type: "ACCESS_REVOKED",
      actorId,
      targetId: userId,
      message: `Revoked ${user.name}'s access to ${MOCK_APPS.join(", ")}.`,
    },
  });

  return {
    userId,
    docsTransferred: ownedDocs.length,
    accessRevoked: MOCK_APPS,
  };
}
