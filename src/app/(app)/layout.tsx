import { Sidebar } from "@/components/shell/sidebar";
import { requireUser } from "@/lib/auth";
import { getOrgTeams } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const teams = await getOrgTeams(user.organizationId);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        userName={user.name}
        userRole={user.role}
        canManageOrg={user.role === "OWNER" || user.role === "TEAM_LEADER"}
      />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
