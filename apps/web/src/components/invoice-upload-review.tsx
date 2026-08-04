"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDocuments, useUploadDocument, useAssignInvoice, viewDocument, type DocumentItem } from "@/hooks/use-documents";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Owner's quick multi-file "upload this month's invoices" entry point. */
export function UploadInvoicesDialog({ onClose }: { onClose: () => void }) {
  const upload = useUploadDocument();
  const [periodMonth, setPeriodMonth] = useState(currentMonthStr());
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        await upload.mutateAsync({ file, category: "INVOICE", periodMonth });
      }
      toast.success(`${files.length} invoice${files.length === 1 ? "" : "s"} uploaded — the PM will assign them`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload invoices</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>Billing month</Label>
            <Input type="month" required value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Files</Label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-[11.5px] text-muted-foreground">
              Select all of this month's invoices at once — the PM will assign each to the right apartment.
            </p>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={uploading || files.length === 0}>
              {uploading ? "Uploading…" : `Upload${files.length ? ` ${files.length}` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** PM's triage queue for invoices the Owner uploaded without picking an apartment. */
export function ReviewInvoicesDialog({ onClose }: { onClose: () => void }) {
  const { data: documents, isLoading } = useDocuments({ category: "INVOICE", unassigned: true });
  const [assigning, setAssigning] = useState<DocumentItem | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const sorted = [...(documents?.data ?? [])].sort((a, b) => (a.periodMonth ?? "").localeCompare(b.periodMonth ?? ""));

  async function handlePreview(doc: DocumentItem) {
    setOpening(doc.id);
    try {
      await viewDocument(doc.id);
    } catch {
      toast.error("Could not open document");
    } finally {
      setOpening(null);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invoices to assign</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting — all caught up.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{doc.fileName}</div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {doc.periodMonth ? monthLabel(doc.periodMonth.slice(0, 7)) : "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={opening === doc.id} onClick={() => handlePreview(doc)}>
                      Preview
                    </Button>
                    <Button size="sm" onClick={() => setAssigning(doc)}>
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {assigning && <AssignInvoiceDialog doc={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

function AssignInvoiceDialog({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const { data: apartments } = useApartments();
  const assign = useAssignInvoice();
  const [apartmentId, setApartmentId] = useState("");
  const [type, setType] = useState<"RENT" | "UTILITIES" | "RENT_AND_UTILITIES">("RENT");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [totalAmountRON, setTotalAmountRON] = useState("");
  const [error, setError] = useState<string | null>(null);

  const periodMonth = doc.periodMonth ? doc.periodMonth.slice(0, 7) : currentMonthStr();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await assign.mutateAsync({
        id: doc.id,
        apartmentId,
        type,
        invoiceNumber: invoiceNumber || undefined,
        issueDate,
        dueDate,
        periodMonth: `${periodMonth}-01`,
        totalAmountRON: Number(totalAmountRON),
      });
      toast.success("Invoice assigned");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign — {doc.fileName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType((v as typeof type) ?? "RENT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RENT">Rent</SelectItem>
                <SelectItem value="UTILITIES">Utilities</SelectItem>
                <SelectItem value="RENT_AND_UTILITIES">Rent + Utilities</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Invoice number — optional</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Issue date</Label>
              <Input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Due date</Label>
              <Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Total amount (RON)</Label>
            <Input type="number" step="0.01" required value={totalAmountRON} onChange={(e) => setTotalAmountRON(e.target.value)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={assign.isPending || !apartmentId || !dueDate || !totalAmountRON}>
              {assign.isPending ? "Assigning…" : "Assign & create invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
