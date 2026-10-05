"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/app/badge";
import { Button } from "@/components/app/button";
import { AppDialog, FormDialog, MODAL_SWAP_MS } from "@/components/app/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { describeFile, editedAgo, FileIcon } from "@/components/app/file-meta";
import {
  PersonChip,
  Bone,
  SectionHeading,
  Switch,
  useUrlRequest,
  Window,
  message,
  plural,
} from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { LIBRARIAN_GROUPS, LibrarianPopup } from "@/components/app/notification-center";
import { AppPage } from "@/components/app/shell";
import { TitleAside, TitleHelp } from "@/components/app/title-aside";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import {
  decideSuggestion,
  fetchSharing,
  peopleById,
  saveSharingRule,
  setAutoOwn,
  type Person,
  type ShareRole,
  type Sharing,
  type SharingRule,
  type SharingTeam,
} from "@/lib/governance";

/** A short list of names: "Priya, Daniel and Marcus". */
function names(people: (Person | undefined)[]) {
  const first = people.filter(Boolean).map((p) => p!.name.split(" ")[0]);
  if (first.length <= 1) return first.join("");
  return `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
}

/** Sharing: what happens the moment a file is made, team by team, and the
 *  caller's own files that are waiting on a share. */
export function SharingScreen() {
  const { chrome } = useSession();
  const org = chrome.organizationId;
  const [data, setData] = useState<Sharing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [editing, setEditing] = useState<SharingTeam | null>(null);
  /** The rule being edited, kept here so it survives the swap to Add. */
  const [draft, setDraft] = useState<SharingRule | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** Rule ⇄ Add hand-off under way: both keep the backdrop steady, as
   *  Manage teams ⇄ New team do (home-actions.tsx). */
  const [swapping, setSwapping] = useState(false);
  const swap = (run: () => void) => {
    setSwapping(true);
    window.setTimeout(() => {
      run();
      window.setTimeout(() => setSwapping(false), MODAL_SWAP_MS);
    }, MODAL_SWAP_MS);
  };
  const startEditing = (t: SharingTeam) => {
    setEditing(t);
    setDraft(t.rule);
    setRuleOpen(true);
  };
  const { reloadTasks } = useUpdates();

  // Notifications' "files to share" row lands here as ?review=1.
  const [reviewParam, clearReview] = useUrlRequest("review");
  useEffect(() => {
    if (!reviewParam) return;
    // Opening the dialog the URL asked for, once per arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSharesOpen(true);
    clearReview();
  }, [reviewParam, clearReview]);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchSharing(org));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [org]);

  useEffect(() => {
    // Loads on open; state is set only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const people = useMemo(() => peopleById(data?.people ?? []), [data]);
  const topLeaders = (data?.top_leader_ids ?? []).map((id) => people.get(id));

  async function decide(fileId: string, share: boolean) {
    setBusy(fileId);
    try {
      await decideSuggestion(fileId, share);
      await refresh();
      reloadTasks();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(teamId: string, on: boolean) {
    setData((d) =>
      d ? { ...d, teams: d.teams.map((t) => (t.id === teamId ? { ...t, auto_own: on } : t)) } : d,
    );
    try {
      await setAutoOwn(org, teamId, on);
    } catch (e) {
      setError(message(e));
      await refresh();
    }
  }

  if (error && !data)
    return (
      <AppPage>
        <Window>
          <EmptyState icon="share" title="Couldn't load sharing" description={error} />
        </Window>
      </AppPage>
    );

  return (
    <AppPage>
      <LibrarianPopup kinds={LIBRARIAN_GROUPS[2].kinds} onAction={() => setSharesOpen(true)} />
      <TitleAside>
        <TitleHelp label="About Sharing">
          <p>
            New files are shared with their team automatically.
          </p>
        </TitleHelp>
      </TitleAside>
      <Window>
        <div className="p-8">
          {/* "Access follows your teams" is the title's `?`, and the files
              waiting on a share open from Notifications (Ronald 2026-10-04). */}
          <SectionHeading
            title="Team rules"
            detail="What happens to a new file, by the team that made it."
          />
          {!data ? (
            <RuleCardsSkeleton />
          ) : data.teams.length === 0 ? (
            <EmptyState
              icon="share"
              title="No teams yet"
              description="Rules follow your teams. Add teams in Manage teams on Home and each gets its own."
            />
          ) : (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
              {data.teams.map((t) => {
                const lead = t.lead_id ? people.get(t.lead_id) : undefined;
                const target = t.owner_target_id ? people.get(t.owner_target_id) : undefined;
                return (
                  <section key={t.id} className="rounded-[24px] border border-[var(--app-border)] p-5">
                    <header className="flex items-center gap-3">
                      <TeamIcon name={t.name} size={36} className="shrink-0 rounded-[10px]" />
                      <div className="min-w-0 flex-1">
                        <h3 className={`${sohne.className} truncate text-[1rem] tracking-tight text-[#1c1917]`}>
                          {t.name}
                        </h3>
                        <p className={`${satoshi.className} text-[0.8125rem] text-[var(--app-dim)]`}>
                          {plural(t.member_count, "person", "people")} · {plural(t.file_count, "file", "files")}
                        </p>
                      </div>
                      {t.can_edit ? (
                        <Button size="sm" variant="outline" onClick={() => startEditing(t)}>
                          Edit
                        </Button>
                      ) : null}
                    </header>
                    <dl className={`${satoshi.className} mt-4 flex flex-col gap-3 text-[0.875rem]`}>
                      <div>
                        <dt className="text-[0.8125rem] text-[var(--app-dim)]">New files are shared with</dt>
                        <dd className="mt-1 text-[#1c1917]">{sharedWith(t, data, people, topLeaders)}</dd>
                      </div>
                      <div>
                        <dt className="text-[0.8125rem] text-[var(--app-dim)]">Access</dt>
                        <dd className="mt-1 text-[#1c1917]">{ROLE_LABEL[t.rule.role]}</dd>
                      </div>
                      <div>
                        <dt className="text-[0.8125rem] text-[var(--app-dim)]">Owned by</dt>
                        <dd className="mt-1 flex min-w-0 items-center gap-1.5">
                          <PersonChip person={target} />
                          {/* Home's lead chip, not a bracketed note (Ronald, 2026-10-04). */}
                          {lead && target && lead.id === target.id ? <Badge>Lead</Badge> : null}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
                      <span className={`${satoshi.className} text-[0.875rem] text-[#1c1917]`}>
                        {t.auto_own ? "Ownership moves automatically" : "Ownership moves after a review"}
                      </span>
                      <Switch
                        checked={t.auto_own}
                        disabled={!t.can_edit}
                        label={`Move ownership automatically for ${t.name}`}
                        onChange={(on) => void toggle(t.id, on)}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {error && data ? (
            <p className={`${satoshi.className} mt-4 text-[0.875rem] text-[#EA4335]`}>{error}</p>
          ) : null}
        </div>
      </Window>

      {editing && draft && data ? (
        <>
          <RuleDialog
            org={org}
            open={ruleOpen}
            swap={swapping}
            team={editing}
            data={data}
            people={people}
            topLeaders={topLeaders}
            rule={draft}
            setRule={setDraft}
            onAdd={() => {
              // No overlapping dialogs: the rule closes, then Add opens.
              setRuleOpen(false);
              swap(() => setAddOpen(true));
            }}
            onClose={() => setRuleOpen(false)}
            onSaved={async () => {
              setRuleOpen(false);
              await refresh();
            }}
          />
          <AddShareDialog
            open={addOpen}
            swap={swapping}
            team={editing}
            data={data}
            rule={draft}
            onAdd={(teamIds, memberIds) =>
              setDraft((r) =>
                r
                  ? {
                      ...r,
                      extra_team_ids: [...new Set([...r.extra_team_ids, ...teamIds])],
                      extra_member_ids: [...new Set([...r.extra_member_ids, ...memberIds])],
                    }
                  : r,
              )
            }
            onClose={() => {
              setAddOpen(false);
              // Back to the rule once Add has closed.
              swap(() => setRuleOpen(true));
            }}
          />
        </>
      ) : null}

      <AppDialog
        open={sharesOpen}
        onOpenChange={setSharesOpen}
        title="Waiting for you"
        footer={<Button onClick={() => setSharesOpen(false)}>Done</Button>}
      >
        <p className={`${satoshi.className} mb-4 text-[0.9375rem] text-[var(--app-dim)]`}>
          Files you made outside Knohow. Share them the way Knohow would have?
        </p>
        {data?.suggestions.length ? (
          <ul className="flex flex-col gap-2">
                {data.suggestions.map((s) => {
                  const recipients = s.recipient_ids.map((id) => people.get(id));
                  return (
                    <li
                      key={s.id}
                      className={`${satoshi.className} flex flex-col gap-3 rounded-[20px] bg-[var(--app-muted)] p-4`}
                    >
                      {/* The file name matters most, so it's never cut off
                          (Ronald 2026-10-04): it gets its own line and wraps;
                          who it goes to and the buttons sit underneath. */}
                      <span className="flex items-start gap-3">
                        <FileIcon mimeType={s.mime_type} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[0.9375rem] text-[#1c1917]">{s.title}</span>
                          <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                            {describeFile(s.mime_type).label}
                            {s.modified_at ? ` · ${editedAgo(s.modified_at)}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex shrink-0 -space-x-1.5">
                            {recipients.slice(0, 3).map((p) =>
                              p ? (
                                <span key={p.id} className="rounded-full ring-2 ring-[var(--app-muted)]">
                                  <PersonAvatar identity={p.email} label={p.name} size={22} />
                                </span>
                              ) : null,
                            )}
                          </span>
                          <span className="text-[0.8125rem] text-[var(--app-dim)]">
                            With {names(recipients)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === s.file_id}
                            onClick={() => void decide(s.file_id, false)}
                          >
                            Not now
                          </Button>
                          <Button size="sm" disabled={busy === s.file_id} onClick={() => void decide(s.file_id, true)}>
                            {busy === s.file_id ? "Sharing…" : "Share"}
                          </Button>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
        ) : (
          <p className={`${satoshi.className} py-8 text-center text-[0.9375rem] text-[var(--app-dim)]`}>
            Nothing waiting for you.
          </p>
        )}
      </AppDialog>
    </AppPage>
  );
}

const ROLE_LABEL: Record<ShareRole, string> = {
  writer: "Can edit",
  commenter: "Can comment",
  reader: "Can view",
};

/** "Everyone on Design except Sam, plus everyone on Sales, Priya and Alex". */
function sharedWith(
  t: SharingTeam,
  data: Sharing,
  people: Map<string, Person>,
  topLeaders: (Person | undefined)[],
) {
  const left = t.rule.excluded_member_ids.map((id) => people.get(id));
  const extras = [
    ...t.rule.extra_team_ids
      .map((id) => data.teams.find((x) => x.id === id)?.name)
      .filter(Boolean)
      .map((name) => `everyone on ${name}`),
    ...t.rule.extra_member_ids
      .map((id) => people.get(id)?.name.split(" ")[0])
      .filter((n): n is string => Boolean(n)),
    ...(t.rule.top_leaders
      ? topLeaders.filter(Boolean).map((p) => p!.name.split(" ")[0])
      : []),
  ];
  const tail =
    extras.length <= 1
      ? extras.join("")
      : `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}`;
  return `Everyone on ${t.name}${left.length ? ` except ${names(left)}` : ""}${tail ? `, plus ${tail}` : ""}`;
}

type PickerItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  badges?: React.ReactNode;
  current?: boolean;
  onPick: () => void;
};

/** The app's dropdown (Manage teams' link lifetime menu): a white pill
 *  that opens a rounded white list, here with team icons and avatars. It
 *  opens inside a dialog, so it sits above dialogs (500). */
function PickerMenu({
  trigger,
  groups,
}: {
  trigger: React.ReactNode;
  groups: { label?: string; items: PickerItem[] }[];
}) {
  const shown = groups.filter((g) => g.items.length > 0);
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={shown.length === 0}
        className={`${satoshi.className} flex h-10 w-fit max-w-full cursor-pointer items-center gap-2 rounded-full border border-[var(--app-border)] bg-white pr-4 pl-3 text-[#1c1917] outline-none transition-colors duration-150 hover:border-[#d9d9de] focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 disabled:cursor-default disabled:opacity-60 data-[popup-open]:border-[#1c1917]`}
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        {/* Always above the pill: it sits at the dialog's foot, and the
            arrow on the pill points up to match. */}
        <Menu.Positioner side="top" align="end" sideOffset={6} className="isolate z-[550]">
          <Menu.Popup
            className={`${satoshi.className} app-modal max-h-[18rem] min-w-[15rem] overflow-y-auto rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            {shown.map((group, i) => (
              <Menu.Group key={group.label ?? i}>
                {group.label ? (
                  <Menu.GroupLabel className="px-4 pt-3 pb-1 text-[0.8125rem] text-[var(--app-dim)]">
                    {group.label}
                  </Menu.GroupLabel>
                ) : null}
                {group.items.map((item) => (
                  <Menu.Item
                    key={item.key}
                    onClick={item.onPick}
                    className={`mx-1 flex h-10 cursor-pointer items-center gap-2.5 rounded-[12px] px-3 text-[0.9375rem] outline-none select-none data-[highlighted]:bg-[var(--app-muted)] ${
                      item.current ? "font-medium text-[#1c1917]" : "text-[#44403c]"
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                    {item.badges}
                    {item.current ? <Check aria-hidden className="ml-auto size-4 shrink-0" /> : null}
                  </Menu.Item>
                ))}
              </Menu.Group>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
const LABEL_CLASS = "text-[0.875rem] font-medium text-[#1c1917]";
const ROW_CLASS = "flex items-center justify-between gap-4";

/** Edit a team's rule (Ronald 2026-10-04): who new files go to, at what
 *  access, and who owns them. */
function RuleDialog({
  org,
  open,
  swap,
  team,
  data,
  people,
  topLeaders,
  rule,
  setRule,
  onAdd,
  onClose,
  onSaved,
}: {
  org: string;
  open: boolean;
  swap: boolean;
  team: SharingTeam;
  data: Sharing;
  people: Map<string, Person>;
  topLeaders: (Person | undefined)[];
  rule: SharingRule;
  setRule: (update: (r: SharingRule | null) => SharingRule | null) => void;
  onAdd: () => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<SharingRule>) => setRule((r) => (r ? { ...r, ...patch } : r));

  const members = data.people.filter((p) => p.team_ids.includes(team.id));
  // Google only moves ownership between accounts on your domain.
  const owners = data.people.filter((p) => !p.personal);
  const leaders = topLeaders.filter((p): p is Person => Boolean(p));
  const ownerId = rule.owner_override_id ?? team.lead_id;
  const owner = ownerId ? people.get(ownerId) : undefined;

  const toggleIn = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

  return (
    <FormDialog
      open={open}
      swap={swap}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`${team.name} rule`}
      submitLabel="Save"
      busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await saveSharingRule(org, team.id, rule);
          await onSaved();
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className={`${satoshi.className} flex flex-col gap-6`}>
        <section className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>New files are shared with</span>
          <ul className="flex flex-col gap-1">
            {members.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 py-1 text-[0.9375rem] text-[#1c1917]">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#1c1917]"
                    checked={!rule.excluded_member_ids.includes(p.id)}
                    onChange={(e) =>
                      set({ excluded_member_ids: toggleIn(rule.excluded_member_ids, p.id, !e.target.checked) })
                    }
                  />
                  <PersonAvatar identity={p.email} label={p.name} size={22} />
                  <span className="min-w-0 truncate">{p.name}</span>
                  <PersonBadges person={p} team={team} data={data} />
                </label>
              </li>
            ))}
          </ul>
          {/* The top leaders, named with their badges rather than a bare
              "Plus Alex" (Ronald 2026-10-04); one switch for all of them. */}
          {leaders.length ? (
            <div className="mt-1 flex items-center justify-between gap-3">
              <ul className="flex min-w-0 flex-col gap-1">
                {leaders.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-w-0 items-center gap-3 py-1 text-[0.9375rem] text-[#1c1917]"
                  >
                    <span aria-hidden className="size-4 shrink-0" />
                    <PersonAvatar identity={p.email} label={p.name} size={22} />
                    <span className="min-w-0 truncate">{p.name}</span>
                    <PersonBadges person={p} team={team} data={data} />
                  </li>
                ))}
              </ul>
              <Switch
                checked={rule.top_leaders}
                label={`Share new files with ${names(leaders)}`}
                onChange={(on) => set({ top_leaders: on })}
              />
            </div>
          ) : null}
        </section>

        {/* Each setting reads left to right: label, then its control
            (Ronald 2026-10-04). */}
        <section className="flex flex-col gap-3">
          <div className={ROW_CLASS}>
            <span className={LABEL_CLASS}>Also share with</span>
            {/* Opens its own dialog, like Manage teams' New team. */}
          <Button variant="outline" className="group shrink-0" onClick={onAdd}>
            {/* New team's plus (home-actions.tsx). */}
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-4 shrink-0 transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 motion-reduce:transition-none"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add a team or person
          </Button>
          </div>
          {rule.extra_team_ids.length || rule.extra_member_ids.length ? (
            <ul className="flex flex-wrap justify-end gap-2">
              {rule.extra_team_ids.map((id) => {
                const name = data.teams.find((x) => x.id === id)?.name ?? "A team";
                return (
                  <Picked
                    key={id}
                    icon={<TeamIcon name={name} size={20} className="shrink-0 rounded-[5px]" />}
                    label={`Everyone on ${name}`}
                    onRemove={() => set({ extra_team_ids: toggleIn(rule.extra_team_ids, id, false) })}
                  />
                );
              })}
              {rule.extra_member_ids.map((id) => (
                <Picked
                  key={id}
                  icon={
                    people.get(id) ? (
                      <PersonAvatar identity={people.get(id)!.email} label={people.get(id)!.name} size={20} />
                    ) : null
                  }
                  label={people.get(id)?.name ?? "Someone"}
                  onRemove={() => set({ extra_member_ids: toggleIn(rule.extra_member_ids, id, false) })}
                />
              ))}
            </ul>
          ) : null}
        </section>

        <section className={ROW_CLASS}>
          <span id="rule-access" className={LABEL_CLASS}>
            Access
          </span>
          <div role="radiogroup" aria-labelledby="rule-access" className="flex shrink-0 gap-2">
            {(Object.keys(ROLE_LABEL) as ShareRole[]).map((role) => (
              <Button
                key={role}
                role="radio"
                aria-checked={rule.role === role}
                variant={rule.role === role ? "default" : "outline"}
                size="sm"
                onClick={() => set({ role })}
              >
                {ROLE_LABEL[role]}
              </Button>
            ))}
          </div>
        </section>

        <div className={ROW_CLASS}>
          <span className={LABEL_CLASS}>Owned by</span>
          <PickerMenu
            trigger={
              <>
                {owner ? (
                  <PersonAvatar identity={owner.email} label={owner.name} size={22} />
                ) : null}
                <span className="text-[13px] font-medium tracking-tight">
                  {owner?.name ?? "The company owner"}
                </span>
                {/* Owner, not Lead: this row is about ownership (Ronald 2026-10-04). */}
                {owner ? <Badge>Owner</Badge> : null}
                {/* Up, because the list opens upward (Ronald 2026-10-04). */}
                <ChevronUp aria-hidden className="-mr-1 size-4 shrink-0 text-[var(--app-dim)]" />
              </>
            }
            groups={[
              {
                items: [
                  ...(team.lead_id
                    ? []
                    : [
                        {
                          key: "company-owner",
                          icon: null,
                          label: "The company owner",
                          current: !owner,
                          onPick: () => set({ owner_override_id: null }),
                        },
                      ]),
                  ...owners.map((p) => ({
                  key: p.id,
                  icon: <PersonAvatar identity={p.email} label={p.name} size={22} />,
                  label: p.name,
                  badges: <PersonBadges person={p} team={team} data={data} />,
                  current: p.id === owner?.id,
                  onPick: () => set({ owner_override_id: p.id }),
                  })),
                ],
              },
            ]}
          />
        </div>

        {error ? <p className="text-[0.875rem] text-[#EA4335]">{error}</p> : null}
      </div>
    </FormDialog>
  );
}

function Picked({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex h-9 items-center gap-2 rounded-full border border-[var(--app-border)] pr-1.5 pl-1.5 text-[0.875rem] text-[#1c1917]">
      {icon}
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="grid size-5 cursor-pointer place-items-center rounded-full text-[var(--app-dim)] hover:bg-black/5"
      >
        <X size={12} strokeWidth={2.2} />
      </button>
    </li>
  );
}

/** "Add a team or person", its own dialog swapped in from the rule (Ronald
 *  2026-10-04, like Manage teams → New team). Tick teams and people; Add
 *  puts them on the rule and swaps back. */
function AddShareDialog({
  open,
  swap,
  team,
  data,
  rule,
  onAdd,
  onClose,
}: {
  open: boolean;
  swap: boolean;
  team: SharingTeam;
  data: Sharing;
  rule: SharingRule;
  onAdd: (teamIds: string[], memberIds: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const teams = data.teams.filter((x) => x.id !== team.id && !rule.extra_team_ids.includes(x.id));
  const people = data.people.filter(
    (p) => !p.team_ids.includes(team.id) && !rule.extra_member_ids.includes(p.id),
  );
  const toggle = (key: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const close = () => {
    setPicked(new Set());
    onClose();
  };

  const row = (key: string, icon: React.ReactNode, label: string, badges?: React.ReactNode) => {
    const on = picked.has(key);
    return (
      <li key={key}>
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          onClick={() => toggle(key)}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2 text-left text-[0.9375rem] text-[#1c1917] outline-none hover:bg-[var(--app-muted)] focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 ${on ? "bg-[var(--app-muted)]" : ""}`}
        >
          {icon}
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 truncate">{label}</span>
            {badges}
          </span>
          <span
            aria-hidden
            className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-[#d9d9de]"}`}
          >
            {on ? <Check size={12} strokeWidth={3} /> : null}
          </span>
        </button>
      </li>
    );
  };

  return (
    <FormDialog
      open={open}
      swap={swap}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title="Add a team or person"
      size="sm"
      submitLabel="Add"
      disabled={picked.size === 0}
      onSubmit={(e) => {
        e.preventDefault();
        const ids = [...picked];
        onAdd(
          ids.filter((k) => k.startsWith("team:")).map((k) => k.slice(5)),
          ids.filter((k) => k.startsWith("person:")).map((k) => k.slice(7)),
        );
        close();
      }}
    >
      <div className={`${satoshi.className} flex flex-col gap-5`}>
        {teams.length === 0 && people.length === 0 ? (
          <p className="py-6 text-center text-[0.9375rem] text-[var(--app-dim)]">
            Everyone is already on this rule.
          </p>
        ) : null}
        {teams.length ? (
          <section className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Teams</span>
            <ul className="flex flex-col">
              {teams.map((x) =>
                row(`team:${x.id}`, <TeamIcon name={x.name} size={30} />, `Everyone on ${x.name}`),
              )}
            </ul>
          </section>
        ) : null}
        {people.length ? (
          <section className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>People</span>
            <ul className="flex flex-col">
              {people.map((p) =>
                row(
                  `person:${p.id}`,
                  <PersonAvatar identity={p.email} label={p.name} size={30} />,
                  p.name,
                  <PersonBadges person={p} team={team} data={data} />,
                ),
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </FormDialog>
  );
}

/** A person's role badges, as Home and Manage teams show them: company
 *  owner, this team's lead, and "Super Admin" (never bare "Admin"). */
function PersonBadges({ person, team, data }: { person: Person; team: SharingTeam; data: Sharing }) {
  return (
    <>
      {data.owner_id === person.id ? <Badge>Owner</Badge> : null}
      {team.lead_id === person.id ? <Badge>Lead</Badge> : null}
      {person.super_admin ? <Badge>Super Admin</Badge> : null}
    </>
  );
}

/** The team rule cards while loading: same grid, card, and sections. */
function RuleCardsSkeleton() {
  // Each text line sits in a box of that line's height, so a card is as
  // tall as a real one.
  const line = (bone: string, height = "h-5") => (
    <span className={`flex ${height} items-center`}>
      <Bone className={`rounded-full ${bone}`} />
    </span>
  );
  return (
    <div aria-hidden className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <section key={i} className="rounded-[24px] border border-[var(--app-border)] p-5">
          <header className="flex items-center gap-3">
            <Bone className="size-9 rounded-[10px]" />
            <div className="min-w-0 flex-1">
              {line("h-4 w-28", "h-6")}
              {line("h-3 w-32")}
            </div>
            <Bone className="h-8 w-14 rounded-full" />
          </header>
          <div className="mt-4 flex flex-col gap-3">
            {["w-48", "w-16", "w-28"].map((w, j) => (
              <div key={j}>
                {line("h-3 w-32")}
                <div className="mt-1">{line(`h-3.5 ${w}`)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
            {line("h-3.5 w-48")}
            <Bone className="h-6 w-10 rounded-full" />
          </div>
        </section>
      ))}
    </div>
  );
}
