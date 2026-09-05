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

export type OffboardResult = {
  docsTransferred: number;
  accessRevoked: string[];
};

export type ShareChoice = "POLICY" | "LEADER" | "OWNER" | "EVERYONE" | "PRIVATE";

export type CreateDocResult = {
  documentId: string;
  folder: string;
  sharedWith: string[];
};

function unavailable(): never {
  throw new Error("Database unavailable — Prisma has been removed.");
}

/**
 * Onboarding seam — previously mutated SQLite via Prisma (ADR-0001).
 * Stubbed until a durable database is wired for production.
 */
export async function onboardPerson(_input: OnboardInput): Promise<OnboardResult> {
  unavailable();
}

export async function offboardPerson(
  _organizationId: string,
  _userId: string,
  _actorId: string
): Promise<OffboardResult> {
  unavailable();
}

export async function createAndFileDocument(_input: {
  organizationId: string;
  actorId: string;
  title: string;
  type: "DOC" | "SHEET" | "SLIDE";
  share: ShareChoice;
}): Promise<CreateDocResult> {
  unavailable();
}

export { MOCK_APPS };
