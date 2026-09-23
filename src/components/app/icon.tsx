import {
  Bell,
  CircleHelp,
  Folder,
  Link,
  LogOut,
  Shield,
  User,
  UserCog,
} from "lucide-react";
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
  notifications: 0xe7f5,
  add: 0xe145,
  help: 0xe8fd,
  settings: 0xe8b8,
  visibility: 0xe8f4,
} as const;

/** A second, tiny set: VS Code's codicons, inlined as paths. The toggle in
 *  `PanelToggle` established them here (Material's nearest glyph was wrong
 *  twice over); `home` joined for Home (user 2026-09-22). Inlined rather than
 *  pulling a second icon font in for two icons — @vscode/codicons, MIT,
 *  © Microsoft, 16×16. */
export const CODICONS = {
  home: "M7.31299 1.26164C7.69849 0.897163 8.30151 0.897163 8.68701 1.26164L13.5305 5.84098C13.8302 6.12431 14 6.51853 14 6.93094V12.5002C14 13.3286 13.3284 14.0002 12.5 14.0002H10.5C9.67157 14.0002 9 13.3286 9 12.5002V10.0002C9 9.72407 8.77614 9.50021 8.5 9.50021H7.5C7.22386 9.50021 7 9.72407 7 10.0002V12.5002C7 13.3286 6.32843 14.0002 5.5 14.0002H3.5C2.67157 14.0002 2 13.3286 2 12.5002V6.93094C2 6.51853 2.1698 6.12431 2.46948 5.84098L7.31299 1.26164ZM8 1.98828L3.15649 6.56762C3.0566 6.66207 3 6.79347 3 6.93094V12.5002C3 12.7763 3.22386 13.0002 3.5 13.0002H5.5C5.77614 13.0002 6 12.7763 6 12.5002V10.0002C6 9.17179 6.67157 8.50022 7.5 8.50022H8.5C9.32843 8.50022 10 9.17179 10 10.0002V12.5002C10 12.7763 10.2239 13.0002 10.5 13.0002H12.5C12.7761 13.0002 13 12.7763 13 12.5002V6.93094C13 6.79347 12.9434 6.66207 12.8435 6.56762L8 1.98828Z",
} as const;

/** And the lucide icons: the ones whose sidebar rows morph them on hover (see
 *  `NAV_MORPH`). The resting icon has to be the same drawing as the one that
 *  animates, so every surface showing it — an empty state, say — uses this. */
/** Lucide's 2px default is drawn for a 24px box; at 22px beside 400-weight
 *  text it out-weighs both the label and the Material glyphs next to it.
 *  1.75 is the match (see `make-interfaces-feel-better`'s icon guidance). */
export const NAV_STROKE = 1.75;

export const LUCIDE = {
  bell: Bell,
  "circle-help": CircleHelp,
  folder: Folder,
  "log-out": LogOut,
  "user-cog": UserCog,
  link: Link,
  shield: Shield,
  user: User,
} as const;

export type AppIconName =
  keyof typeof APP_ICONS | keyof typeof CODICONS | keyof typeof LUCIDE;

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
  if (name in LUCIDE) {
    const Glyph = LUCIDE[name as keyof typeof LUCIDE];
    return (
      <Glyph
        aria-hidden
        size={size}
        strokeWidth={NAV_STROKE}
        className={cn("inline-block shrink-0", className)}
      />
    );
  }

  if (name in CODICONS)
    return (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="currentColor"
        width={size}
        height={size}
        className={cn("inline-block shrink-0 select-none", className)}
      >
        <path d={CODICONS[name as keyof typeof CODICONS]} />
      </svg>
    );

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
      {String.fromCodePoint(APP_ICONS[name as keyof typeof APP_ICONS])}
    </span>
  );
}
