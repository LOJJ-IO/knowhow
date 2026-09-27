import { AppEntry } from "@/components/login/app-entry";
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
  return <AppEntry joinToken={token} joinPreview={preview} />;
}
