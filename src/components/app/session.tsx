"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { LoadingMark } from "@/components/brand/loading-mark";
import { type Me } from "@/lib/backend";
import { fetchMe } from "@/lib/remembered-accounts";
import { chromeFromMe, type OrganizationChrome } from "@/lib/organization";

/** Who is signed in, for the whole app.
 *
 *  It has to be fetched in the browser: the session cookies live on the
 *  backend's origin, so a Server Component here can't see them. One fetch at
 *  the top, handed down by context, rather than every screen asking.
 *
 *  No session means no app — the landing owns signing in, so we send them
 *  there rather than rendering a shell around nothing. */
type Session = {
  me: Me;
  chrome: OrganizationChrome;
  /** After a rename in Settings, so the sidebar and topbar follow. */
  setOrganizationName: (name: string) => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error("useSession must be used inside AppSessionProvider");
  return session;
}

export function AppSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Omit<
    Session,
    "setOrganizationName"
  > | null>(null);
  const setOrganizationName = useCallback(
    (name: string) =>
      setSession((current) =>
        current
          ? {
              me: { ...current.me, organization_name: name },
              chrome: { ...current.chrome, name },
            }
          : current,
      ),
    [],
  );
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((me) => {
      if (cancelled) return;
      if (me) setSession({ me, chrome: chromeFromMe(me) });
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checked && !session) router.replace("/");
  }, [checked, session, router]);

  // Loading, and on the way back to the landing: the turning mark, not a
  // line of text (user 2026-09-27).
  if (!session)
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--app-ground)]">
        <LoadingMark
          label={checked ? "Taking you to sign in" : "Loading"}
          className="w-16"
        />
      </div>
    );

  return (
    <SessionContext.Provider value={{ ...session, setOrganizationName }}>
      {children}
    </SessionContext.Provider>
  );
}
