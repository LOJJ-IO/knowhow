import type { Metadata } from "next";

import { siteOrigin } from "@/lib/site-origin";

/** Public metadata for a join link — from `GET /join-links/{token}`. */
export type JoinLinkPreview = {
  organization_name: string;
  organization_domain: string | null;
  valid: boolean;
  title: string;
  description: string;
};

export async function fetchJoinPreview(
  token: string,
): Promise<JoinLinkPreview | null> {
  const base = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(
      `${base}/join-links/${encodeURIComponent(token)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as JoinLinkPreview;
  } catch {
    return null;
  }
}

export function joinLinkMetadata(
  preview: JoinLinkPreview | null,
  canonicalPath: string,
): Metadata {
  const title = preview?.title ?? "Join on Knohow";
  const description =
    preview?.description ??
    "Sign in with Google to join your team on Knohow.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteOrigin()}${canonicalPath}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** Reads a join token from the current URL — `/join/{token}` or legacy `?join=`. */
export function readJoinToken(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  const fromPath = path.match(/^\/join\/([^/]+)$/)?.[1];
  if (fromPath) return fromPath;
  const fromQuery = new URLSearchParams(window.location.search).get("join");
  return fromQuery || null;
}
