"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDocuments, useUploadDocument, useDeleteDocument, downloadDocument } from "@/hooks/use-documents";
import { getAccessToken } from "@/lib/api-client";
import { dateFormatter } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export function ApartmentPhotosTab({ apartmentId, canEdit }: { apartmentId: string; canEdit: boolean }) {
  const { data, isLoading } = useDocuments({ apartmentId, category: "PHOTO" });
  const upload = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const photos = [...(data?.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        await upload.mutateAsync({ file, category: "PHOTO", apartmentId });
      }
      toast.success(files.length > 1 ? "Photos uploaded" : "Photo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this photo? This can't be undone.")) return;
    try {
      await deleteDocument.mutateAsync(id);
      toast.success("Photo deleted");
    } catch {
      toast.error("Could not delete photo");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium">Add photos</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={upload.isPending}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : photos.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No photos uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              id={p.id}
              fileName={p.fileName}
              createdAt={p.createdAt}
              canEdit={canEdit}
              deleting={deleteDocument.isPending}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  id,
  fileName,
  createdAt,
  canEdit,
  deleting,
  onDelete,
}: {
  id: string;
  fileName: string;
  createdAt: string;
  canEdit: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/documents/${id}/download`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        });
        if (!res.ok) throw new Error("download failed");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <div className="group relative overflow-hidden rounded-[12px] border border-border bg-card shadow-sm">
      <button onClick={() => downloadDocument(id, fileName)} className="block h-[130px] w-full bg-muted" title={fileName}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
            {failed ? "Preview unavailable" : "Loading…"}
          </div>
        )}
      </button>
      <div className="px-2 py-1.5">
        <div className="text-[11px] text-muted-foreground">{dateFormatter.format(new Date(createdAt))}</div>
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="absolute top-1.5 right-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] text-destructive opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          title="Delete photo"
        >
          ×
        </button>
      )}
    </div>
  );
}
