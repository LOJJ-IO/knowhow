import {
  FileText,
  Sheet as SheetIcon,
  Presentation,
  ListChecks,
  Mail,
  Video,
  MessageSquare,
  HardDrive,
} from "lucide-react";

import { TeamDocumentsBoard } from "@/components/dashboard/team-documents-board";
import { Card } from "@/components/ui/card";

const CREATE_TILES = [
  { label: "New Google Doc", icon: FileText, href: "https://docs.google.com/document/create" },
  { label: "New Google Sheet", icon: SheetIcon, href: "https://docs.google.com/spreadsheets/create" },
  { label: "New Google Slide", icon: Presentation, href: "https://docs.google.com/presentation/create" },
  { label: "New Form/Other", icon: ListChecks, href: "https://docs.google.com/forms/create" },
];

const ALL_APPS = [
  { label: "Drive", icon: HardDrive },
  { label: "Gmail", icon: Mail },
  { label: "Meet", icon: Video },
  { label: "Chat", icon: MessageSquare },
];

type Owner = { id: string; name: string };
type DocRow = { id: string; title: string; createdAt: Date; sharedWithOwner: boolean; owner: Owner };
type Columns = { DOC: DocRow[]; SHEET: DocRow[]; SLIDE: DocRow[] };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Organization Owner",
  TEAM_LEADER: "Google Workspace Leader",
  MEMBER: "Team Member",
};

export function MemberDashboard({
  name,
  role,
  columns,
}: {
  name: string;
  role: string;
  columns: Columns;
}) {
  const owners = Array.from(
    new Map(
      [...columns.DOC, ...columns.SHEET, ...columns.SLIDE].map((d) => [d.owner.id, d.owner])
    ).values()
  );

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-foreground">Welcome back, {name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABEL[role] ?? role}</p>

      <h2 className="mt-6 mb-3 text-sm font-medium text-foreground">Create New Work</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CREATE_TILES.map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:bg-muted"
          >
            <tile.icon className="size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{tile.label}</span>
          </a>
        ))}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-medium text-foreground">All Apps</h2>
      <Card className="flex flex-wrap gap-4 p-4">
        {ALL_APPS.map((app) => (
          <div key={app.label} className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
              <app.icon className="size-4" />
            </div>
            {app.label}
          </div>
        ))}
      </Card>

      <h2 className="mt-6 mb-3 text-sm font-medium text-foreground">Shared With You</h2>
      <TeamDocumentsBoard columns={columns} owners={owners} />
    </div>
  );
}
