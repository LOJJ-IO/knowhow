"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { satoshi } from "@/components/brand/fonts";
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
type Session = { me: Me; chrome: OrganizationChrome };

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
  const [session, setSession] = useState<Session | null>(null);
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

  if (!session)
    return (
      <div
        className={`${satoshi.className} flex h-dvh items-center justify-center bg-[var(--app-ground)] text-[0.9375rem] text-[var(--app-dim)]`}
      >
        {checked ? "Taking you to sign in…" : ""}
      </div>
    );

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
