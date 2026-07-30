"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDocuments, useUploadDocument, downloadDocument, type DocumentItem } from "@/hooks/use-documents";
import type { UtilityRecord } from "@/hooks/use-utility-records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateFormatter } from "@/lib/format";

/** "See pictures" for a meter reading — lists any photos linked to it, with upload when `canUpload`. */
export function MeterPicturesDialog({
  record,
  onClose,
  canUpload = false,
}: {
  record: UtilityRecord;
  onClose: () => void;
  canUpload?: boolean;
}) {
  const { data: documents, isLoading } = useDocuments({ utilityRecordId: record.id });
  const upload = useUploadDocument();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category: "PHOTO", utilityRecordId: record.id });
      toast.success("Photo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {record.apartment?.name} — {record.utilityType.replace("_", " ")} meter photos
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : documents && documents.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {documents.data.map((d) => (
                <PhotoCard key={d.id} doc={d} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pictures uploaded for this reading yet.</p>
          )}
          {canUpload && (
            <label className="flex cursor-pointer flex-col gap-2">
              <Label>Upload a picture</Label>
              <Input type="file" accept="image/*" onChange={handleFile} disabled={upload.isPending} />
            </label>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhotoCard({ doc }: { doc: DocumentItem }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDocument(doc.id, doc.fileName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-[12px] border border-border bg-card p-3 text-center shadow-sm transition-shadow hover:shadow-md disabled:opacity-60"
    >
      <div className="mb-1 truncate text-[12px] font-medium">{doc.fileName}</div>
      <div className="text-[11px] text-muted-foreground">{dateFormatter.format(new Date(doc.createdAt))}</div>
    </button>
  );
}
