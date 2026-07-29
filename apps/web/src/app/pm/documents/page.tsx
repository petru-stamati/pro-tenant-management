"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useDocuments, useUploadDocument, downloadDocument, type DocumentItem } from "@/hooks/use-documents";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { dateFormatter } from "@/lib/format";

const CATEGORIES = [
  "CONTRACT",
  "ID_PASSPORT",
  "MOVE_IN_REPORT",
  "MOVE_OUT_REPORT",
  "ANNEX",
  "RENEWAL",
  "INVOICE",
  "RECEIPT",
  "INSURANCE",
  "PHOTO",
  "VIDEO",
  "MAINTENANCE",
  "OTHER",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { data: documents, isLoading } = useDocuments();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Documents</h1>
          <p className="text-[13.5px] text-muted-foreground">{documents?.data.length ?? 0} files</p>
        </div>
        <UploadDialog />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : documents && documents.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {documents.data.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No documents uploaded yet.
        </div>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentItem }) {
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

  const ext = doc.fileName.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-[12px] border border-border bg-card p-4 text-center shadow-sm transition-shadow hover:shadow-md disabled:opacity-60"
    >
      <div className="mx-auto mb-2.5 flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-accent font-heading text-xs font-bold text-accent-foreground">
        {ext.slice(0, 4)}
      </div>
      <div className="mb-0.5 truncate text-[12.5px] font-semibold">{doc.fileName}</div>
      <div className="text-[11px] text-muted-foreground">
        {doc.category.replace(/_/g, " ")} · {formatSize(doc.sizeBytes)}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{dateFormatter.format(new Date(doc.createdAt))}</div>
    </button>
  );
}

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const { data: apartments } = useApartments();
  const upload = useUploadDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category, apartmentId: apartmentId || undefined });
      toast.success("Document uploaded");
      setOpen(false);
      setFile(null);
      setCategory("");
      setApartmentId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Upload document</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Apartment</Label>
            <Select value={apartmentId} onValueChange={(v) => setApartmentId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select an apartment" />
              </SelectTrigger>
              <SelectContent>
                {apartments?.data.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={upload.isPending || !file || !category || !apartmentId}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
