"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/app/badge";
import {
  FadeScroll,
  TEAM_CLEAR_WIDTH,
} from "@/components/app/notifications-dialog";
import { NAV_STROKE } from "@/components/app/icon";
import { MENU_ITEM } from "@/components/app/profile-menu";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { TeamIcon } from "@/components/identity/team-icon";
import { cn } from "@/lib/utils";
import {
  assignTeamLead,
  removeFromTeam,
  type OverviewMember,
  type OverviewTeam,
} from "@/lib/organization";

/** Manage teams' Teams tab, drawn like Notifications' Teams tab (user
 *  2026-09-27): each team's icon and name, its members under it instead of
 *  updates. Hovering (or focusing) a member springs in a horizontal kebab in
 *  the circle the red minus uses there, grey instead of red; it opens Make
 *  Team Lead and, in red, Remove Member.
 *
 *  The owner and a Super Admin also get the same kebab on each team's row
 *  (Ronald, 2026-10-10; a red minus before): Rename, and in red, Remove
 *  team. Each asks the caller to open its dialog. */
export function TeamMembersSection({
  onRenameTeam,
  onRemoveTeam,
}: {
  onRenameTeam?: (team: OverviewTeam) => void;
  onRemoveTeam?: (team: OverviewTeam) => void;
}) {
  const { chrome, me } = useSession();
  const { overview, refresh } = useUpdates();
  const [error, setError] = useState("");

  if (!overview) return null;

  const membersById = new Map(overview.members.map((m) => [m.id, m]));
  const canRemoveTeams = me.is_owner || me.is_super_admin;

  async function act(run: () => Promise<void>) {
    setError("");
    try {
      await run();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <FadeScroll>
        {overview.teams.map((team) => {
          const members = team.memberIds
            .map((id) => membersById.get(id))
            .filter((m): m is OverviewMember => Boolean(m));
          return (
            // A hairline between teams, halfway across the gap FadeScroll
            // puts between them (user 2026-09-27).
            <div
              key={team.id}
              className="relative flex flex-col gap-1.5 [&+&]:before:absolute [&+&]:before:inset-x-0 [&+&]:before:top-[calc(-3.871rem/2)] [&+&]:before:h-px [&+&]:before:bg-[var(--app-border)] [&+&]:before:content-['']"
            >
              <div className="group flex items-center gap-2.5">
                <TeamIcon name={team.name} size={30} />
                <span
                  className={`${satoshi.className} min-w-0 flex-1 truncate text-[1.28rem] font-medium text-[#1c1917]`}
                >
                  {team.name}
                </span>
                {canRemoveTeams && onRenameTeam && onRemoveTeam ? (
                  // In the column the member kebabs use.
                  <span
                    className={`${TEAM_CLEAR_WIDTH} relative flex h-5 shrink-0 items-center pl-3.5`}
                  >
                    <TeamMenu
                      name={team.name}
                      onRename={() => onRenameTeam(team)}
                      onRemove={() => onRemoveTeam(team)}
                    />
                  </span>
                ) : null}
              </div>
              {/* Home's empty-team line, in a member row's place (user
                  2026-09-27). */}
              {members.length === 0 ? (
                <p
                  className={`${satoshi.className} m-0 pl-[34px] text-[0.875rem] text-[var(--app-dim)]`}
                >
                  Nobody is in this team yet.
                </p>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[34px]">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className={`${satoshi.className} group flex items-center gap-3 text-[0.875rem]`}
                  >
                    {/* Lead right after the name, as on Home. */}
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="min-w-0 truncate text-[#1c1917]">
                        {member.displayName ?? member.email}
                      </span>
                      {team.leaderId === member.id ? <Badge>Lead</Badge> : null}
                      {/* "Super Admin", never bare "Admin", in copy. */}
                      {member.isSuperAdmin ? <Badge>Super Admin</Badge> : null}
                    </span>
                    <span
                      className={`${TEAM_CLEAR_WIDTH} relative flex h-5 shrink-0 items-center pl-3.5`}
                    >
                      <MemberMenu
                        name={member.displayName ?? member.email}
                        isLead={team.leaderId === member.id}
                        // A Super Admin can't take themselves off a team,
                        // and a lead can't remove a Super Admin (user
                        // 2026-09-27). A lead who is also the owner or a
                        // Super Admin still can.
                        canRemove={
                          !(member.id === me.id && me.is_super_admin) &&
                          !(
                            member.isSuperAdmin &&
                            me.is_team_lead &&
                            !me.is_owner &&
                            !me.is_super_admin
                          )
                        }
                        onMakeLead={() =>
                          act(() =>
                            assignTeamLead(
                              chrome.organizationId,
                              team.id,
                              member.id,
                            ),
                          )
                        }
                        onRemove={() =>
                          act(() =>
                            removeFromTeam(
                              chrome.organizationId,
                              team.id,
                              member.id,
                            ),
                          )
                        }
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </FadeScroll>
      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 mt-3 text-[0.8125rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

/** The grey kebab that springs in on a row's hover or focus, and stays
 *  while its menu is open. */
const KEBAB_TRIGGER =
  "absolute left-3.5 grid size-[18px] cursor-pointer scale-50 place-items-center rounded-full bg-[var(--app-active)] opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100 hover:bg-[#dcdad6] focus-visible:ring-2 focus-visible:ring-[#1c1917]/20 active:scale-90 data-[popup-open]:scale-100 data-[popup-open]:opacity-100 motion-reduce:scale-100";

const KEBAB_DOTS = (
  <span aria-hidden className="flex items-center gap-[2px]">
    <span className="size-[3px] rounded-full bg-[#1c1917]" />
    <span className="size-[3px] rounded-full bg-[#1c1917]" />
    <span className="size-[3px] rounded-full bg-[#1c1917]" />
  </span>
);

/** A team's kebab (Ronald, 2026-10-10): Rename with the pencil, and Remove
 *  team with the bin in Notifications' destructive red, like the Workspace
 *  right-click menu. */
function TeamMenu({
  name,
  onRename,
  onRemove,
}: {
  name: string;
  onRename: () => void;
  onRemove: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`Options for ${name}`} className={KEBAB_TRIGGER}>
        {KEBAB_DOTS}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="isolate z-[550]">
          <Menu.Popup
            className={`${satoshi.className} app-modal min-w-[11rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            <Menu.Item onClick={onRename} className={MENU_ITEM}>
              <Pencil size={18} strokeWidth={NAV_STROKE} />
              Rename
            </Menu.Item>
            <Menu.Item
              onClick={onRemove}
              className={cn(MENU_ITEM, "text-[#EA4335] data-[highlighted]:text-[#EA4335]")}
            >
              <Trash2 size={18} strokeWidth={NAV_STROKE} />
              Remove team
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The kebab and its menu, drawn like the Joining tab's lifetime menu. Stays
 *  shown while its menu is open. */
function MemberMenu({
  name,
  isLead,
  canRemove,
  onMakeLead,
  onRemove,
}: {
  name: string;
  isLead: boolean;
  canRemove: boolean;
  onMakeLead: () => void;
  onRemove: () => void;
}) {
  const item =
    "mx-1 flex h-10 cursor-pointer items-center rounded-[12px] px-3 text-[0.9375rem] outline-none select-none data-[highlighted]:bg-[var(--app-muted)]";
  // Nothing to offer (a Super Admin's own row where they already lead): no
  // kebab at all.
  if (isLead && !canRemove) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Options for ${name}`}
        className={KEBAB_TRIGGER}
      >
        {KEBAB_DOTS}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="isolate z-[550]">
          <Menu.Popup
            className={`${satoshi.className} app-modal min-w-[11rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            {isLead ? null : (
              <Menu.Item onClick={onMakeLead} className={`${item} text-[#1c1917]`}>
                Make Team Lead
              </Menu.Item>
            )}
            {canRemove ? (
              <Menu.Item onClick={onRemove} className={`${item} text-[#EA4335]`}>
                Remove Member
              </Menu.Item>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
