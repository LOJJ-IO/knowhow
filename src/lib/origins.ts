/** Landing and app live on separate origins (ADR 0022): knohow.app for the
 *  landing, app.knohow.app for sign-in, onboarding and the app. Locally
 *  both are unset: one origin serves both, with the app's front door at
 *  `/entry`. (A local split can't work: the app must be on `localhost` to share
 *  the backend's cookies, and Next's dev server rewrites any redirect to
 *  `localhost` onto the visitor's own host.) */
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "";

export const ORIGINS_SPLIT =
  Boolean(APP_ORIGIN) && Boolean(SITE_ORIGIN) && APP_ORIGIN !== SITE_ORIGIN;

/** Where sign-in, onboarding and Google's results render. */
export function appEntryUrl(search = "") {
  return ORIGINS_SPLIT ? `${APP_ORIGIN}/${search}` : `/entry${search}`;
}

/** A landing path, from wherever you are. */
export function siteUrl(path = "/") {
  return ORIGINS_SPLIT ? `${SITE_ORIGIN}${path}` : path;
}

/** Query keys the backend and older links hand to the app on return from
 *  Google (or from an invite / join link). Arriving on the landing with one
 *  of these means the visitor belongs on the app's front door. */
export const APP_RETURN_PARAMS = [
  "join",
  "invite",
  "admin_proof",
  "signup",
  "link",
  "drive_connected",
] as const;
