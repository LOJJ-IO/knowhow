import Link from "next/link";
import {
  Activity,
  LayoutGrid,
  Network,
  Settings,
  LifeBuoy,
  Users,
} from "lucide-react";

import { logOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarTeam = { id: string; name: string };

type SidebarProps = {
  teams: SidebarTeam[];
  userName: string;
  userRole: string;
  canManageOrg: boolean;
};

const navItem =
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export function Sidebar({ teams, userName, userRole, canManageOrg }: SidebarProps) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="mb-6 px-1.5 text-lg text-sidebar-foreground">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <Link href="/dashboard" className={navItem}>
          <LayoutGrid className="size-4" />
          Overall Dashboard
        </Link>
        <Link href="/activity" className={navItem}>
          <Activity className="size-4" />
          Activity
        </Link>

        {canManageOrg ? (
          <Link href="/org-chart" className={navItem}>
            <Network className="size-4" />
            Org Chart
          </Link>
        ) : null}

        <p className="mt-4 mb-1 px-2.5 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
          All Teams
        </p>
        {teams.map((team) => (
          <Link key={team.id} href={`/team/${team.id}/people`} className={cn(navItem, "pl-4")}>
            <Users className="size-3.5" />
            {team.name}
          </Link>
        ))}

        <div className="flex-1" />

        {canManageOrg ? (
          <Link href="/settings" className={navItem}>
            <Settings className="size-4" />
            Settings
          </Link>
        ) : null}
        <span className={cn(navItem, "cursor-default hover:bg-transparent")}>
          <LifeBuoy className="size-4" />
          Support
        </span>
      </nav>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border px-1.5 pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {userRole === "OWNER" ? "Organization Owner" : userRole === "TEAM_LEADER" ? "Team Leader" : "Member"}
          </p>
        </div>
        <form action={logOut}>
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
