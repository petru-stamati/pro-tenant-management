"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDocuments, useUploadDocument, useDeleteDocument, downloadDocument } from "@/hooks/use-documents";
import { useApartment, useUpdateApartment } from "@/hooks/use-apartments";
import { useDocumentBlobUrl } from "@/hooks/use-document-blob-url";
import { dateFormatter } from "@/lib/format";

export function ApartmentPhotosTab({ apartmentId, canEdit }: { apartmentId: string; canEdit: boolean }) {
  const { data, isLoading } = useDocuments({ apartmentId, category: "PHOTO" });
  const { data: apartment } = useApartment(apartmentId);
  const upload = useUploadDocument();
  const updateApartment = useUpdateApartment(apartmentId);
  const deleteDocument = useDeleteDocument();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const photos = [...(data?.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    let succeeded = 0;
    let firstError: string | null = null;
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, category: "PHOTO", apartmentId });
        succeeded++;
      } catch (err) {
        firstError ??= err instanceof Error ? err.message : "Upload failed";
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    e.target.value = "";
    if (succeeded > 0) toast.success(`${succeeded} of ${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
    if (firstError) toast.error(succeeded > 0 ? `Some photos failed: ${firstError}` : `Upload failed: ${firstError}`);
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

  async function handleSetCover(id: string) {
    try {
      await updateApartment.mutateAsync({ coverDocumentId: id });
      toast.success("Cover photo updated");
    } catch {
      toast.error("Could not set cover photo");
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
            disabled={!!progress}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
          />
          {progress && (
            <p className="text-[12.5px] text-muted-foreground">
              Uploading {progress.done} of {progress.total}…
            </p>
          )}
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
              isCover={apartment?.coverDocumentId === p.id}
              deleting={deleteDocument.isPending}
              settingCover={updateApartment.isPending}
              onDelete={() => handleDelete(p.id)}
              onSetCover={() => handleSetCover(p.id)}
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
  isCover,
  deleting,
  settingCover,
  onDelete,
  onSetCover,
}: {
  id: string;
  fileName: string;
  createdAt: string;
  canEdit: boolean;
  isCover: boolean;
  deleting: boolean;
  settingCover: boolean;
  onDelete: () => void;
  onSetCover: () => void;
}) {
  const { url, failed, error } = useDocumentBlobUrl(id);

  return (
    <div className="group relative overflow-hidden rounded-[12px] border border-border bg-card shadow-sm">
      <button onClick={() => downloadDocument(id, fileName)} className="block h-[130px] w-full bg-muted" title={fileName}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-2 text-center text-[11px] text-muted-foreground">
            <span>{failed ? "Preview unavailable" : "Loading…"}</span>
            {failed && error && <span className="text-[9.5px] opacity-70">{error}</span>}
          </div>
        )}
      </button>
      {isCover && (
        <span className="absolute top-1.5 left-1.5 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          Cover
        </span>
      )}
      <div className="px-2 py-1.5">
        <div className="text-[11px] text-muted-foreground">{dateFormatter.format(new Date(createdAt))}</div>
      </div>
      {canEdit && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isCover && (
            <button
              type="button"
              disabled={settingCover}
              onClick={onSetCover}
              className="rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] shadow-sm hover:border-primary"
              title="Set as cover photo"
            >
              ★
            </button>
          )}
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] text-destructive shadow-sm"
            title="Delete photo"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
