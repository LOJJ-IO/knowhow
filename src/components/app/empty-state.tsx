import type { ReactNode } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppIcon, type AppIconName } from "@/components/app/icon";
import { cn } from "@/lib/utils";

/** The app's one empty state. Own this instead of writing a centred div per
 *  screen — a second shape is how the copy, the icon size and the spacing start
 *  disagreeing between screens.
 *
 *  What it says, in order: what would be here, why it is not here yet, and the
 *  single thing that fills it. Everything is optional except the first two: an
 *  empty state with no explanation is just a blank screen with an icon on it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: AppIconName;
  title: string;
  description: string;
  /** The screen's one action, if there is something the person can do now. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--app-muted)] text-[#57534e]">
        <AppIcon name={icon} size={22} />
      </div>
      <h2
        className={`${sohne.className} mt-5 text-[1.125rem] leading-[1.3] tracking-tight text-[#1c1917]`}
      >
        {title}
      </h2>
      <p
        className={`${satoshi.className} mt-2 max-w-[26rem] text-[0.9375rem] leading-[1.55] text-[var(--app-dim)]`}
      >
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
