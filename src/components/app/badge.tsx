import { satoshi } from "@/components/brand/fonts";

/** The muted chip beside a name: "New" on a team, "Lead" on a member (Home
 *  and Manage teams). The app's grey with 5px corners. */
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`${satoshi.className} inline-flex shrink-0 items-center rounded-[5px] bg-[var(--app-muted)] px-1.5 py-[0.15rem] text-[0.6875rem] font-medium text-[var(--app-dim)]`}
    >
      {children}
    </span>
  );
}
