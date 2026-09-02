import { HardDrive, Mail, MessageSquare, Video } from "lucide-react";

import { CreateWorkPanel } from "@/components/dashboard/create-work-panel";
import { DocTypeIcon, type DocTypeKey } from "@/components/dashboard/doc-type-icon";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { TeamDocumentsBoard } from "@/components/dashboard/team-documents-board";
import { Card } from "@/components/ui/card";

const ALL_APPS = [
  { label: "Drive", icon: HardDrive, tint: "text-gyellow" },
  { label: "Gmail", icon: Mail, tint: "text-gred" },
  { label: "Meet", icon: Video, tint: "text-ggreen" },
  { label: "Chat", icon: MessageSquare, tint: "text-gblue" },
];

type Owner = { id: string; name: string };
type DocRow = { id: string; title: string; createdAt: Date; sharedWithOwner: boolean; owner: Owner };
type Columns = { DOC: DocRow[]; SHEET: DocRow[]; SLIDE: DocRow[] };

export type MyDocRow = {
  id: string;
  title: string;
  type: DocTypeKey;
  createdAt: Date;
  sharedWithOwner: boolean;
  sharedWithLeader: boolean;
  sharedWithEveryone: boolean;
  team: { name: string } | null;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Organization Owner",
  TEAM_LEADER: "Google Workspace Leader",
  MEMBER: "Team Member",
};

function shareLabel(doc: MyDocRow) {
  if (doc.sharedWithEveryone) return "Shared with everyone";
  const parts = [];
  if (doc.sharedWithLeader) parts.push("team leader");
  if (doc.sharedWithOwner) parts.push("owner");
  return parts.length > 0 ? `Auto-shared with ${parts.join(" and ")}` : "Private";
}

export function MemberDashboard({
  name,
  role,
  columns,
  myDocs,
}: {
  name: string;
  role: string;
  columns: Columns;
  myDocs: MyDocRow[];
}) {
  const owners = Array.from(
    new Map(
      [...columns.DOC, ...columns.SHEET, ...columns.SLIDE].map((d) => [d.owner.id, d.owner])
    ).values()
  );

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-foreground">Welcome back, {name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABEL[role] ?? role}</p>

      <div className="mt-5">
        <GlobalSearch placeholder="Find Apps or Files" />
      </div>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-foreground">Create New Work</h2>
      <CreateWorkPanel isOwner={false} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">My Recent Work</h2>
          <Card className="overflow-hidden p-0">
            {myDocs.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Nothing yet — create your first document above.
              </p>
            ) : (
              <ul>
                {myDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0"
                  >
                    <DocTypeIcon type={doc.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Drive › {doc.team?.name ?? "Company"} · {shareLabel(doc)} ·{" "}
                        {doc.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">All Apps</h2>
          <Card className="flex flex-wrap gap-4 p-4">
            {ALL_APPS.map((app) => (
              <div key={app.label} className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                  <app.icon className={`size-4 ${app.tint}`} />
                </div>
                {app.label}
              </div>
            ))}
          </Card>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-foreground">Shared With You</h2>
      <TeamDocumentsBoard columns={columns} owners={owners} />
    </div>
  );
}
