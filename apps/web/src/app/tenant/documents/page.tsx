"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDocuments, downloadDocument, type DocumentItem } from "@/hooks/use-documents";
import { dateFormatter } from "@/lib/format";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TenantDocumentsPage() {
  const { data: documents, isLoading } = useDocuments();

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Documents</h1>
        <p className="text-[13.5px] text-muted-foreground">Your lease and related files</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : documents && documents.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {documents.data.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No documents yet.
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
