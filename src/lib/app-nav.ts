/** The signed-in app's navigation, named once.
 *
 *  One entry per feature in the landing deck — see
 *  `second-brain/Product/Features/FEAT-core-app-screens.md`. The sidebar, the
 *  page headings and each screen's empty state all read from here, so a
 *  screen's name and purpose can never drift between them. */

export type AppSection = "Organization" | "Access" | "People";

export type AppNavItem = {
  /** The label in the sidebar and the page's heading. */
  label: string;
  href: string;
  section: AppSection;
  /** The one line under the heading. Why the screen exists, in the user's terms. */
  purpose: string;
};

export const APP_NAV: AppNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    section: "Organization",
    purpose: "Where your organization stands.",
  },
  {
    label: "Workspace",
    href: "/workspace",
    section: "Organization",
    purpose: "Every document the organization owns, in one place.",
  },
  {
    label: "Oversight",
    href: "/oversight",
    section: "Organization",
    purpose: "What your teams created, edited and shared.",
  },
  {
    label: "Ownership",
    href: "/ownership",
    section: "Access",
    purpose: "Who owns each document, and what you can do about it.",
  },
  {
    label: "Sharing",
    href: "/sharing",
    section: "Access",
    purpose: "The rules that decide who gets access, without anyone asking.",
  },
  {
    label: "Org chart",
    href: "/org-chart",
    section: "Access",
    purpose: "Your teams and their leads. Access follows this chart.",
  },
  {
    label: "Offboarding",
    href: "/offboarding",
    section: "People",
    purpose: "Move someone's work to the organization before they leave.",
  },
];

/** Search is reached from the search field at the top of the sidebar, not from
 *  the section list, so it is kept out of `APP_NAV`. */
export const APP_SEARCH: AppNavItem = {
  label: "Search",
  href: "/search",
  section: "Organization",
  purpose: "Find any document in the organization.",
};

/** The rows at the foot of the sidebar. Kept out of `APP_NAV` because they
 *  aren't features of the product — they sit under the sections, quieter, the
 *  way Elera's do (user 2026-09-21).
 *
 *  Settings is **not** here: it opens as a dialog over whatever you were
 *  looking at rather than being a place you navigate to, so it has no route.
 *  See `settings-dialog.tsx`. */
export const APP_UTILITY: AppNavItem[] = [
  {
    label: "Help",
    href: "/help",
    section: "Organization",
    purpose: "Answers, and a way to reach us.",
  },
];

export const APP_SECTIONS: AppSection[] = ["Organization", "Access", "People"];

export function navItemFor(href: string): AppNavItem {
  const item = [...APP_NAV, APP_SEARCH, ...APP_UTILITY].find(
    (i) => i.href === href,
  );
  if (!item) throw new Error(`No nav entry for ${href}`);
  return item;
}

/** Where a signed-in member lands when the landing has nothing left to ask:
 *  after the account picker signs them in, and at the end of org setup.
 *
 *  The dashboard, because it is the one screen that reflects what setup just
 *  produced. One constant so changing it is one edit. */
export const APP_HOME = "/dashboard";
