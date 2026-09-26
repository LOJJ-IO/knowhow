"use client";

import { useEffect, useState } from "react";
import { SetupBody, SetupError, SetupField, SetupHeading } from "./shell";
import { SetupShareAction } from "./setup-share-action";
import { backendError, backendFetch, type Me } from "@/lib/backend";

/** "No" / "I don't know" to the Super Admin question: they can't give
 *  Knohow access to the company's Drive, so hand them the open admin link to
 *  send to whoever can. Google decides who that is when the link is opened,
 *  so it carries no email. Copy is the one action, and it finishes setup. */
export function AdminLinkStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/invitations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "super_admin" }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
        const invitation = await res.json();
        if (!cancelled) setUrl(invitation.url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  return (
    <div>
      <SetupHeading>Invite your Super Admin.</SetupHeading>
      <SetupBody>
        Whoever opens this link signs in with Google, and Google checks
        whether they&rsquo;re your Google Workspace Super Admin. If they are,
        they can give Knohow access to {me.organization_name}&rsquo;s Google
        Drive. If not, they join {me.organization_name} like anyone else. The link works for 7 days.
      </SetupBody>
      <div className="mt-6">
        <SetupField
          readOnly
          value={url}
          aria-label="Super Admin invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="text-[0.85rem] text-[#1c1917]/70"
        />
      </div>
      <SetupError>{error}</SetupError>
      <SetupShareAction
        onClick={async () => {
          if (!url) return false;
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            /* still show Copied — the URL is in the field to select */
          }
          window.setTimeout(onDone, 600);
        }}
      />
    </div>
  );
}
