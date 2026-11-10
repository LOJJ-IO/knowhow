import { redirect } from "next/navigation";

import { AppEntry } from "@/components/login/app-entry";
import { BACKEND_API_URL } from "@/lib/backend";
import { fetchJoinPreview, joinLinkMetadata } from "@/lib/join-link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await fetchJoinPreview(token);
  return joinLinkMetadata(preview, `/join/${token}`);
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await fetchJoinPreview(token);
  // The demo's own link: no sign-in, straight into joining.
  if (preview?.demo && preview.valid)
    redirect(`${BACKEND_API_URL}/sandbox/join/${encodeURIComponent(token)}`);
  return <AppEntry joinToken={token} joinPreview={preview} />;
}
