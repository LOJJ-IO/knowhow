import { backendError, backendFetch } from "@/lib/backend";

export type DrivePreviewFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: string | null;
};

export type DrivePreview = {
  connected: boolean;
  connectedAs: string | null;
  files: DrivePreviewFile[];
};

type PreviewResponse = {
  connected: boolean;
  connected_as: string | null;
  files: {
    id: string;
    name: string;
    mime_type: string;
    modified_at: string | null;
  }[];
};

/** A live, unsaved look at the signed-in person's own Drive. The backend reads
 *  it through their delegated client; nothing is indexed. */
export async function fetchDrivePreview(
  organizationId: string,
): Promise<DrivePreview> {
  const res = await backendFetch(
    `/organizations/${organizationId}/drive-preview`,
  );
  if (!res.ok) throw new Error(await backendError(res));
  const body = (await res.json()) as PreviewResponse;
  return {
    connected: body.connected,
    connectedAs: body.connected_as,
    files: body.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mime_type,
      modifiedAt: f.modified_at,
    })),
  };
}
