import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import { NAV_ICONS } from "@/components/app/nav-icons";

/** A whole screen that has nothing in it yet: the page shell plus the one
 *  empty state, marked with the same icon as its sidebar row.
 *
 *  Every screen starts here. As a screen gets real content it keeps `AppPage`
 *  and renders `EmptyState` only for the case where its list comes back
 *  empty. */
export function EmptyScreen({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <AppPage>
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[16px] bg-white">
        <EmptyState
          icon={NAV_ICONS[href]}
          title={title}
          description={description}
        />
      </div>
    </AppPage>
  );
}
