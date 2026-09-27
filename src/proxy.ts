import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  APP_ORIGIN,
  APP_RETURN_PARAMS,
  ORIGINS_SPLIT,
  SITE_ORIGIN,
} from "@/lib/origins";

/** Paths that belong to the app, never the landing. */
const APP_PATHS = [
  "/entry",
  "/join",
  "/home",
  "/help",
  "/offboarding",
  "/ownership",
  "/search",
  "/sharing",
  "/workspace",
];

function isAppPath(pathname: string) {
  return APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hostOf(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

/** A cross-origin redirect by hand. `NextResponse.redirect` runs its target
 *  through NextURL, which treats every loopback name as one host; a raw
 *  Location header keeps the target exactly as written. */
function redirectTo(location: string) {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

/** Splits one Next.js deployment across two origins (ADR 0022): the landing
 *  on SITE_ORIGIN, sign-in + onboarding + the app on APP_ORIGIN. */
export function proxy(request: NextRequest) {
  const { pathname, searchParams, search } = request.nextUrl;

  // Canonical join URLs live at `/join/{token}`. Legacy `/?join=` links still
  // work, but redirect so crawlers and share targets get one shape.
  const join = pathname === "/" ? searchParams.get("join") : null;
  const returning =
    pathname === "/" && APP_RETURN_PARAMS.some((k) => searchParams.has(k));

  if (!ORIGINS_SPLIT) {
    if (join) {
      const url = request.nextUrl.clone();
      url.pathname = `/join/${join}`;
      url.searchParams.delete("join");
      return NextResponse.redirect(url);
    }
    if (returning) {
      const url = request.nextUrl.clone();
      url.pathname = "/entry";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? request.nextUrl.host;
  const onApp = host === hostOf(APP_ORIGIN);
  const onSite = host === hostOf(SITE_ORIGIN);

  if (onSite) {
    // Old links and anything app-shaped go to the app's origin, query intact.
    if (isAppPath(pathname) || returning)
      return redirectTo(`${APP_ORIGIN}${pathname}${search}`);
    return NextResponse.next();
  }

  if (onApp) {
    if (join) {
      const url = new URL(`/join/${join}`, APP_ORIGIN);
      searchParams.forEach((v, k) => {
        if (k !== "join") url.searchParams.set(k, v);
      });
      return NextResponse.redirect(url);
    }
    // The app's front door is its root.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/entry";
      return NextResponse.rewrite(url);
    }
    // One address for the front door.
    if (pathname === "/entry")
      return NextResponse.redirect(new URL(`/${search}`, APP_ORIGIN));
  }

  return NextResponse.next();
}

export const config = {
  // Pages only — not Next's assets or files in public/.
  matcher: "/((?!_next/|favicon\\.ico|.*\\.[^/]+$).*)",
};
