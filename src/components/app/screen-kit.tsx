"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/app/button";
import { NAV_STROKE } from "@/components/app/icon";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { cn } from "@/lib/utils";

/** The pieces every app screen is built from, so Workspace, Ownership,
 *  Sharing, Search, Offboarding and Help read as one product. */

/** The screen's one white window, as on Home. */
export function Window({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[32px] bg-white">
      {children}
    </section>
  );
}

/** A section heading with an optional action on the right. */
export function SectionHeading({
  title,
  detail,
  action,
  className,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h2
          className={`${sohne.className} text-[1.125rem] leading-[1.3] tracking-tight text-[#1c1917]`}
        >
          {title}
        </h2>
        {detail ? (
          <p className={`${satoshi.className} mt-1 text-[0.875rem] text-[var(--app-dim)]`}>
            {detail}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** A muted strip with an icon tile, a line of text and its actions. */
export function Bar({
  icon,
  title,
  body,
  footnote,
  error,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  footnote?: string;
  error?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-[24px] bg-[var(--app-muted)] p-5",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#57534e]">
        {icon}
      </span>
      <div className={`${satoshi.className} min-w-[14rem] flex-1`}>
        <div className={`${sohne.className} text-[1rem] tracking-tight text-[#1c1917]`}>
          {title}
        </div>
        <p
          className={cn(
            "mt-0.5 text-[0.875rem] leading-[1.5]",
            error ? "text-[#EA4335]" : "text-[var(--app-dim)]",
          )}
        >
          {body}
        </p>
        {footnote ? (
          <p className="mt-0.5 text-[0.8125rem] text-[var(--app-dim)]">{footnote}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Where you are: every segment but the last is a button back to that level. */
export function Breadcrumb({
  trail,
}: {
  trail: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`${satoshi.className} flex items-center gap-1 text-[0.875rem]`}
    >
      {trail.map((seg, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {seg.onClick && !last ? (
              <button
                type="button"
                onClick={seg.onClick}
                className="cursor-pointer rounded-[6px] px-1 py-0.5 text-[var(--app-dim)] outline-none hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-[#1c1917]"
              >
                {seg.label}
              </button>
            ) : (
              <span
                className={cn(
                  "px-1 py-0.5",
                  last ? "text-[#1c1917]" : "text-[var(--app-dim)]",
                )}
              >
                {seg.label}
              </span>
            )}
            {last ? null : (
              <ChevronRight
                size={14}
                strokeWidth={NAV_STROKE}
                className="text-[var(--app-dim)]"
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** One choice out of a few: the Notifications tab look (outline, black when on). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <Button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          size="sm"
          variant={value === o.value ? "default" : "outline"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? (
            <span
              className={cn(
                "ml-0.5 tabular-nums",
                value === o.value ? "text-white/70" : "text-[var(--app-dim)]",
              )}
            >
              {o.count}
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}

/** A person, as a small orb and their name. */
export function PersonChip({
  person,
  size = 20,
  muted = false,
}: {
  person: { name: string; email: string } | null | undefined;
  size?: number;
  muted?: boolean;
}) {
  if (!person)
    return (
      <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
        Nobody
      </span>
    );
  return (
    <span className={`${satoshi.className} inline-flex min-w-0 items-center gap-2`}>
      <PersonAvatar identity={person.email} label={person.name} size={size} />
      <span
        className={cn(
          "truncate text-[0.875rem]",
          muted ? "text-[var(--app-dim)]" : "text-[#1c1917]",
        )}
      >
        {person.name}
      </span>
    </span>
  );
}

/** A team, as its generated mark and its name. */
export function TeamChip({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className={`${satoshi.className} inline-flex min-w-0 items-center gap-2`}>
      <TeamIcon name={name} size={size} className="shrink-0 rounded-[6px]" />
      <span className="truncate text-[0.875rem] text-[#1c1917]">{name}</span>
    </span>
  );
}

/** A loading placeholder row, in the app's muted grey. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-[16px] bg-[var(--app-muted)]" />
      ))}
    </div>
  );
}

/** On/off, drawn like Manage teams' joining switches. */
export function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-[background-color,translate] duration-150 active:translate-y-px disabled:cursor-default disabled:opacity-60 ${
        checked ? "bg-[#1c1917]" : "bg-[var(--app-active)]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] duration-150 ${
          checked ? "left-[1.125rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
