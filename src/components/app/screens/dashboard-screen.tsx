"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { fetchOrgOverview, type OrgOverview } from "@/lib/organization";

/** The first screen after sign-in: what onboarding produced.
 *
 *  The complaint this answers (user 2026-09-21): the work done in onboarding
 *  wasn't reflected anywhere. So every answer setup collects appears here —
 *  the organization's name and the domain it was observed on, whether setup
 *  finished, who owns it, whether Google confirmed a Super Admin, the teams
 *  that were named with the people who said they were in them, everyone in the
 *  organization including anyone still waiting for approval, a person's linked
 *  addresses, and whether the join link is live.
 *
 *  One request (`fetchOrgOverview`) rather than five, so it can't half-render. */
export function DashboardScreen() {
  const { chrome, me } = useSession();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  if (error)
    return (
      <AppPage>
        <Panel>
          <EmptyState
            icon="monitoring"
            title="Couldn't load your organization"
            description={error}
          />
        </Panel>
      </AppPage>
    );

  if (!overview)
    return (
      <AppPage>
        <div className="min-h-[18rem] flex-1 rounded-[16px] bg-white" />
      </AppPage>
    );

  const approved = overview.members.filter((m) => m.standing === "approved");
  const superAdmins = overview.members.filter((m) => m.isSuperAdmin);
  // One human's several addresses share a person_id — onboarding's "add
  // another account". Counting people, not accounts, is the honest number.
  const linkedAccounts = overview.members.filter((m) => m.personId).length;
  const people = new Set(
    overview.members.map((m) => m.personId ?? `account:${m.id}`),
  ).size;
  const yourTeams = overview.teams.filter((team) =>
    team.memberIds.includes(me.id),
  );

  return (
    <AppPage>
      <div className="flex flex-col gap-3">
        {/* The organization itself: what it is called, and where it came from. */}
        <Panel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h2
              className={`${sohne.className} m-0 truncate text-[1.25rem] leading-[1.3] tracking-tight text-[#1c1917]`}
            >
              {overview.name}
            </h2>
            <p
              className={`${satoshi.className} m-0 mt-1 truncate text-[0.875rem] leading-[1.4] text-[var(--app-dim)]`}
            >
              {overview.observedDomain
                ? `Signed in from ${overview.observedDomain}`
                : "No Workspace domain on this organization"}
              {overview.setupCompleted ? " · setup complete" : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Chip
              label={
                superAdmins.length
                  ? "Google confirmed a Super Admin"
                  : "Super Admin not confirmed"
              }
              tone={superAdmins.length ? "good" : "waiting"}
            />
            <Chip
              label={overview.joinLinkActive ? "Join link live" : "No join link"}
              tone={overview.joinLinkActive ? "good" : "quiet"}
            />
          </div>
        </Panel>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
          <Stat label="Teams" value={overview.teams.length} />
          <Stat label="People" value={people} />
          <Stat
            label="Waiting for approval"
            value={overview.pendingMembers}
            tone={overview.pendingMembers ? "waiting" : undefined}
          />
          <Stat label="Open invitations" value={overview.openInvitations} />
        </div>

        {/* Teams, with the identity each one was given while being named. */}
        <Panel className="px-5 py-4">
          <SectionHead
            title="Teams"
            hint={
              yourTeams.length
                ? `You are in ${yourTeams.map((t) => t.name).join(", ")}`
                : "You are not in a team yet"
            }
            href="/org-chart"
            hrefLabel="See the chart"
          />
          {overview.teams.length === 0 ? (
            <p
              className={`${satoshi.className} m-0 mt-3 text-[0.875rem] text-[var(--app-dim)]`}
            >
              No teams were created during setup.
            </p>
          ) : (
            <ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2.5 p-0">
              {overview.teams.map((team) => (
                <li key={team.id} className="flex items-center gap-2.5">
                  <TeamIcon name={team.name} size={36} />
                  <div className="min-w-0">
                    <p
                      className={`${satoshi.className} m-0 truncate text-[0.875rem] font-medium leading-[1.4] text-[#1c1917]`}
                    >
                      {team.name}
                    </p>
                    <p
                      className={`${satoshi.className} m-0 truncate text-[0.75rem] leading-[1.4] text-[var(--app-dim)]`}
                    >
                      {team.memberIds.length === 1
                        ? "1 member"
                        : `${team.memberIds.length} members`}
                      {team.autoOwnEnabled ? " · Auto-Own on" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Everyone in the organization, including anyone still waiting. */}
        <Panel className="px-5 py-4">
          <SectionHead
            title="People"
            hint={
              linkedAccounts > 1
                ? `${linkedAccounts} accounts linked to a person`
                : `${approved.length} approved`
            }
          />
          <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
            {overview.members.map((member) => {
              const name = member.displayName ?? member.email;
              const isOwner = member.id === overview.ownerMemberId;
              return (
                <li key={member.id} className="flex items-center gap-2.5">
                  <PersonAvatar
                    identity={member.email}
                    label={name}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`${satoshi.className} m-0 truncate text-[0.875rem] font-medium leading-[1.4] text-[#1c1917]`}
                    >
                      {name}
                      {member.id === me.id ? " (you)" : ""}
                    </p>
                    <p
                      className={`${satoshi.className} m-0 truncate text-[0.75rem] leading-[1.4] text-[var(--app-dim)]`}
                    >
                      {member.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {isOwner ? <Chip label="Owner" tone="good" /> : null}
                    {member.isSuperAdmin ? (
                      <Chip label="Super Admin" tone="good" />
                    ) : null}
                    {member.orgWideRoles.map((role) => (
                      <Chip key={role} label={role.replace(/_/g, " ")} tone="quiet" />
                    ))}
                    {member.standing === "auto_affiliated" ? (
                      <Chip label="Waiting for approval" tone="waiting" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {overview.nominatedSuperAdminEmail ? (
            <p
              className={`${satoshi.className} m-0 mt-3 text-[0.8125rem] leading-[1.5] text-[var(--app-dim)]`}
            >
              {overview.nominatedSuperAdminEmail} was named as owner during
              setup and hasn&rsquo;t signed in yet.
            </p>
          ) : null}
        </Panel>
      </div>
    </AppPage>
  );
}

function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-[16px] bg-white ${className ?? ""}`}>
      {children}
    </section>
  );
}

function SectionHead({
  title,
  hint,
  href,
  hrefLabel,
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h3
        className={`${sohne.className} m-0 text-[1rem] leading-[1.35] tracking-tight text-[#1c1917]`}
      >
        {title}
      </h3>
      <div
        className={`${satoshi.className} flex items-baseline gap-3 text-[0.8125rem] text-[var(--app-dim)]`}
      >
        {hint ? <span className="truncate">{hint}</span> : null}
        {href && hrefLabel ? (
          <Link
            href={href}
            className="shrink-0 border-b border-current font-medium text-[#1c1917]"
          >
            {hrefLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "waiting";
}) {
  return (
    <Panel className="px-5 py-4">
      <p
        className={`${sohne.className} m-0 text-[1.75rem] leading-[1.2] tracking-tight ${
          tone === "waiting" ? "text-[#b45309]" : "text-[#1c1917]"
        }`}
      >
        {value}
      </p>
      <p
        className={`${satoshi.className} m-0 mt-1 text-[0.8125rem] leading-[1.4] text-[var(--app-dim)]`}
      >
        {label}
      </p>
    </Panel>
  );
}

function Chip({
  label,
  tone = "quiet",
}: {
  label: string;
  tone?: "good" | "waiting" | "quiet";
}) {
  const tones = {
    good: "bg-[#e7f3ec] text-[#166534]",
    waiting: "bg-[#fdf1dc] text-[#92400e]",
    quiet: "bg-[var(--app-muted)] text-[#57534e]",
  };
  return (
    <span
      className={`${satoshi.className} inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[0.75rem] font-medium capitalize ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
