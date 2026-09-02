"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { searchDocuments } from "@/lib/queries";
import { createAndFileDocument, type ShareChoice } from "@/lib/workspace";

const SHARE_CHOICES: ShareChoice[] = ["POLICY", "LEADER", "OWNER", "EVERYONE", "PRIVATE"];
const DOC_TYPES = ["DOC", "SHEET", "SLIDE"] as const;

export async function createDocument(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "DOC") as (typeof DOC_TYPES)[number];
  const share = String(formData.get("share") ?? "POLICY") as ShareChoice;

  if (!title) {
    return { error: "Give the document a title." };
  }
  if (!DOC_TYPES.includes(type) || !SHARE_CHOICES.includes(share)) {
    return { error: "Invalid document options." };
  }

  try {
    const result = await createAndFileDocument({
      organizationId: user.organizationId,
      actorId: user.id,
      title,
      type,
      share,
    });

    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the document." };
  }
}

export async function searchAllDocuments(query: string) {
  const user = await requireUser();
  const hits = await searchDocuments(user.organizationId, user, query);

  return hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    type: hit.type,
    ownerName: hit.owner.name,
    folder: hit.team?.name ?? "Company",
    createdAt: hit.createdAt.toISOString(),
  }));
}
