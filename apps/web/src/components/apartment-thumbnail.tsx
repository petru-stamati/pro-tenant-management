"use client";

import { useDocuments } from "@/hooks/use-documents";
import { useDocumentBlobUrl } from "@/hooks/use-document-blob-url";

/** The apartment's most recently uploaded photo, rendered to fill its container — falls back to a plain gradient when there isn't one yet. */
export function ApartmentThumbnail({ apartmentId }: { apartmentId: string }) {
  const { data } = useDocuments({ apartmentId, category: "PHOTO" });
  const latest = [...(data?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const { url } = useDocumentBlobUrl(latest?.id);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  return <div className="h-full w-full bg-gradient-to-br from-accent to-muted" />;
}
