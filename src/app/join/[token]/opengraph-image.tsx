import {
  JOIN_OG_SIZE,
  renderJoinOpenGraphImage,
} from "@/lib/join-opengraph-image";

export const runtime = "nodejs";
export const size = JOIN_OG_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return renderJoinOpenGraphImage(token);
}
