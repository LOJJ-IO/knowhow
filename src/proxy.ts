import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Canonical join URLs live at `/join/{token}`. Legacy `/?join=` links still
 *  work, but redirect so crawlers and share targets get one shape. */
export function middleware(request: NextRequest) {
  const join = request.nextUrl.searchParams.get("join");
  if (!join || request.nextUrl.pathname !== "/") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/join/${join}`;
  url.searchParams.delete("join");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/",
};
