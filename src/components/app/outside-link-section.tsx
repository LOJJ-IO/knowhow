"use client";

import { useEffect, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import {
  LifetimeMenu,
  MIN_CREATING_MS,
  NewLinkButton,
  PILL,
  Row,
} from "@/components/app/joining-section";
import { Switch } from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { TeamIcon } from "@/components/identity/team-icon";
import { CopyField } from "@/components/ui/copy-field";
import {
  createOutsideLink,
  fetchOutsideLink,
  setOutsideAskFirst,
  type OverviewTeam,
} from "@/lib/organization";
import { cn } from "@/lib/utils";

/** Who may make a team's outside link (ADR-0035): its lead, the owner, a
 *  Super Admin, or the founder. The backend checks the same. */
export function useCanManageOutsideLink() {
  const { me } = useSession();
  return (team: OverviewTeam) =>
    me.is_owner ||
    me.is_super_admin ||
    me.is_founding_member ||
    team.leaderId === me.id;
}

/** One team's link for people outside the organization: the link, New link,
 *  "Ask me before they join" (on by default; saves as it's flipped, like
 *  the Joining switches) and the lifetime of new links. `hint` adds the
 *  line saying any Google account works (the team's own dialog has it; the
 *  Joining tab has no hints, user 2026-09-27). */
export function OutsideLinkPanel({
  teamId,
  hint = false,
}: {
  teamId: string;
  hint?: boolean;
}) {
  const { chrome } = useSession();
  const { reloadTasks } = useUpdates();
  const [url, setUrl] = useState("");
  const [askFirst, setAskFirst] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [lifetime, setLifetime] = useState("7d");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const link = await fetchOutsideLink(chrome.organizationId, teamId);
        if (cancelled) return;
        setUrl(link.url ?? "");
        setAskFirst(link.askFirst);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId, teamId]);

  async function newLink() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      // Held as long as the join link's New link, so it reads as a step.
      const [next] = await Promise.all([
        createOutsideLink(chrome.organizationId, teamId, lifetime),
        new Promise((resolve) => window.setTimeout(resolve, MIN_CREATING_MS)),
      ]);
      setUrl(next);
      setCreated(true);
      window.setTimeout(() => setCreated(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function toggleAskFirst(next: boolean) {
    setAskFirst(next);
    setSaving(true);
    setError("");
    try {
      await setOutsideAskFirst(chrome.organizationId, teamId, next);
      reloadTasks();
    } catch (e) {
      setAskFirst(!next);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {url ? (
            <CopyField label="Outside link" value={url} showLabel={false} />
          ) : (
            <p className="m-0 flex h-10 items-center rounded-[var(--login-button-radius,10px)] border border-dashed border-[#d9d9de] px-3 text-[0.8rem] text-[var(--app-dim)]">
              {loaded ? "No link yet" : " "}
            </p>
          )}
        </div>
        <NewLinkButton
          busy={creating}
          created={created}
          onClick={() => void newLink()}
        />
      </div>
      <Row label="Ask me before they join">
        <Switch
          checked={askFirst}
          disabled={!loaded || saving}
          label="Ask me before they join"
          onChange={(next) => void toggleAskFirst(next)}
        />
      </Row>
      <Row label="New links expire after">
        <LifetimeMenu value={lifetime} onChange={setLifetime} />
      </Row>
      {hint ? (
        <p
          className={`${satoshi.className} m-0 text-[0.875rem] leading-[1.4] text-[var(--app-dim)]`}
        >
          Any Google account can use this link, including Gmail.
        </p>
      ) : null}
      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 text-[0.8125rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The Joining tab's Outside link (user 2026-10-16: here and in each team's
 *  menu): pick one of the teams you can manage, then its link. */
export function OutsideLinkSection() {
  const { overview } = useUpdates();
  const canManage = useCanManageOutsideLink();
  // By name: the overview's order moves as teams change, and the list (and
  // the default pick) must not jump under the pointer.
  const teams = (overview?.teams ?? [])
    .filter(canManage)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [teamId, setTeamId] = useState<string | null>(null);
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  if (!team) return null;

  return (
    <div className={`${satoshi.className} flex flex-col gap-5`}>
      <h3 className="m-0 text-[1.0625rem] leading-[1.3] font-bold tracking-tight text-[#1c1917]">
        Outside link
      </h3>
      <Row label="Team">
        <TeamPicker teams={teams} value={team} onChange={setTeamId} />
      </Row>
      <OutsideLinkPanel key={team.id} teamId={team.id} />
    </div>
  );
}

/** The team dropdown, drawn like the lifetime menu. */
function TeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: OverviewTeam[];
  value: OverviewTeam;
  onChange: (teamId: string) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          satoshi.className,
          PILL,
          "w-auto max-w-48 min-w-28 text-[#1c1917] outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 data-[popup-open]:border-[#1c1917]",
        )}
      >
        <TeamIcon name={value.name} size={18} />
        <span className="min-w-0 truncate text-[13px] font-medium tracking-tight">
          {value.name}
        </span>
        <ChevronDown
          aria-hidden
          className="-mr-1 size-4 shrink-0 text-[var(--app-dim)]"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="isolate z-[550]">
          <Menu.Popup
            className={`${satoshi.className} app-modal max-h-72 min-w-[11rem] overflow-y-auto rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            {teams.map((t) => (
              <Menu.Item
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`mx-1 flex h-10 cursor-pointer items-center gap-2 rounded-[12px] px-3 text-[0.9375rem] outline-none select-none data-[highlighted]:bg-[var(--app-muted)] ${
                  t.id === value.id
                    ? "font-medium text-[#1c1917]"
                    : "text-[#44403c]"
                }`}
              >
                <TeamIcon name={t.name} size={18} />
                <span className="min-w-0 truncate">{t.name}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
