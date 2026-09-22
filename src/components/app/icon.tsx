import localFont from "next/font/local";

import { cn } from "@/lib/utils";

/** Google's Material Symbols (Outlined), self-hosted the way every other font
 *  in this repo is — see `src/components/brand/fonts.ts`.
 *
 *  **Subsetted to the icons below.** The file came from Google Fonts with
 *  `&icon_names=…` at fixed axes (`opsz,wght,FILL,GRAD@24,400,0,0`), which is
 *  why it is 2KB instead of 3.8MB. Adding an icon therefore means re-fetching
 *  the subset with the new name in that list, not just adding a line here. */
const materialSymbols = localFont({
  src: "../../fonts/material-symbols/MaterialSymbolsOutlined.woff2",
  weight: "400",
  style: "normal",
  display: "block",
});

/** Icons are addressed by **codepoint**, not by their ligature name: a name
 *  renders as the literal text "folder_open" if the subset ever ships without
 *  its ligature table, and a codepoint cannot fail that way. Values are from
 *  Google's `MaterialSymbolsOutlined.codepoints`, written as numbers so the
 *  source stays readable instead of holding private-use characters. */
export const APP_ICONS = {
  folder_open: 0xe2c8,
  monitoring: 0xf190,
  verified_user: 0xf013,
  share: 0xe80d,
  account_tree: 0xe97a,
  person_remove: 0xef66,
  search: 0xef7a,
  view_sidebar: 0xf114,
  notifications: 0xe7f5,
  add: 0xe145,
  help: 0xe8fd,
  settings: 0xe8b8,
} as const;

export type AppIconName = keyof typeof APP_ICONS;

export function AppIcon({
  name,
  size = 22,
  className,
}: {
  name: AppIconName;
  /** Rendered size in px. The glyph's box is its font size. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        materialSymbols.className,
        "inline-block shrink-0 leading-none select-none",
        className,
      )}
      style={{ fontSize: size, width: size, height: size }}
    >
      {String.fromCodePoint(APP_ICONS[name])}
    </span>
  );
}
