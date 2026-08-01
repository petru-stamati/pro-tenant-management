"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useApartmentInvoices,
  useCreateApartmentInvoice,
  useUpdateApartmentInvoice,
  type ApartmentInvoice,
  type ApartmentInvoiceType,
} from "@/hooks/use-apartment-invoices";
import { useCreatePaymentConfirmation } from "@/hooks/use-payment-confirmations";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useDocuments, useUploadDocument, downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatRON, dateFormatter } from "@/lib/format";

const TYPE_LABEL: Record<ApartmentInvoiceType, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  RENT_AND_UTILITIES: "Rent + Utilities",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PaymentsBoard({ canRecordPayments }: { canRecordPayments: boolean }) {
  const [month, setMonth] = useState(currentMonth());
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: owners } = useOwners();
  const { data: invoices, isLoading: invoicesLoading } = useApartmentInvoices({ month });
  const [uploadFor, setUploadFor] = useState<{ id: string; name: string } | null>(null);
  const [paymentFor, setPaymentFor] = useState<{ id: string; name: string } | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ApartmentInvoice | null>(null);

  const invoicesByApartment = useMemo(() => {
    const map = new Map<string, ApartmentInvoice[]>();
    invoices?.data.forEach((inv) => {
      const list = map.get(inv.apartmentId) ?? [];
      list.push(inv);
      map.set(inv.apartmentId, list);
    });
    return map;
  }, [invoices]);

  const ownerName = (ownerId: string | undefined) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";
  const isLoading = apartmentsLoading || invoicesLoading;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Payments</h1>
        <p className="text-[13.5px] text-muted-foreground">{apartments?.data.length ?? 0} apartments</p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ← Prev
        </Button>
        <div className="min-w-[160px] text-center text-[15px] font-semibold">{monthLabel(month)}</div>
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          Next →
        </Button>
        {month !== currentMonth() && (
          <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
            Today
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : apartments && apartments.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Apartment</th>
                <th className="p-3 font-medium text-muted-foreground">Invoices this month</th>
                <th className="p-3 font-medium text-muted-foreground">Outstanding</th>
                <th className="p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apartments.data.map((a) => {
                const apartmentInvoices = invoicesByApartment.get(a.id) ?? [];
                const outstanding = apartmentInvoices.reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0);
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{ownerName(a.ownerId)}</div>
                    </td>
                    <td className="p-3">
                      {apartmentInvoices.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {apartmentInvoices.map((inv) => (
                            <button
                              key={inv.id}
                              onClick={() => setDetailInvoice(inv)}
                              className="rounded-md border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-primary"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{TYPE_LABEL[inv.type]}</span>
                                <StatusChip tone={paymentStatusTone(inv.status)}>
                                  {inv.status.replace("_", " ").toLowerCase()}
                                </StatusChip>
                              </div>
                              <div className="font-mono-tabular font-mono">{formatRON(inv.totalAmountRON)}</div>
                              <div className="text-[10.5px] text-muted-foreground">
                                due {dateFormatter.format(new Date(inv.dueDate))}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 font-mono-tabular font-mono">{outstanding > 0 ? formatRON(outstanding) : "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setUploadFor({ id: a.id, name: a.name })}>
                          Upload invoice
                        </Button>
                        {canRecordPayments && (
                          <Button size="sm" onClick={() => setPaymentFor({ id: a.id, name: a.name })}>
                            Record payment
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No apartments yet.</p>
        )}
      </div>

      {uploadFor && (
        <UploadInvoiceDialog
          apartmentId={uploadFor.id}
          apartmentName={uploadFor.name}
          defaultMonth={month}
          onClose={() => setUploadFor(null)}
        />
      )}
      {paymentFor && (
        <RecordPaymentDialog apartmentId={paymentFor.id} apartmentName={paymentFor.name} onClose={() => setPaymentFor(null)} />
      )}
      {detailInvoice && (
        <InvoiceDetailDialog
          invoice={detailInvoice}
          canEdit={canRecordPayments}
          onClose={() => setDetailInvoice(null)}
        />
      )}
    </div>
  );
}

function UploadInvoiceDialog({
  apartmentId,
  apartmentName,
  defaultMonth,
  onClose,
}: {
  apartmentId: string;
  apartmentName: string;
  defaultMonth: string;
  onClose: () => void;
}) {
  const create = useCreateApartmentInvoice();
  const upload = useUploadDocument();
  const [type, setType] = useState<ApartmentInvoiceType>("RENT");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [totalAmountRON, setTotalAmountRON] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const invoice = await create.mutateAsync({
        apartmentId,
        type,
        invoiceNumber: invoiceNumber || undefined,
        issueDate,
        dueDate,
        periodMonth: `${periodMonth}-01`,
        totalAmountRON: Number(totalAmountRON),
      });
      if (file) {
        await upload.mutateAsync({ file, category: "INVOICE", apartmentInvoiceId: invoice.id });
      }
      toast.success("Invoice uploaded");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = create.isPending || upload.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload invoice — {apartmentName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType((v as ApartmentInvoiceType) ?? "RENT")}>
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
            <Label>Billing month</Label>
            <Input type="month" required value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            <p className="text-[11.5px] text-muted-foreground">
              Which month this invoice belongs to on the Payments board — set an earlier month to back-fill history.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Total amount (RON)</Label>
            <Input type="number" step="0.01" required value={totalAmountRON} onChange={(e) => setTotalAmountRON(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Invoice document — optional</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || !dueDate || !totalAmountRON}>
              {saving ? "Saving…" : "Save invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetailDialog({
  invoice,
  canEdit,
  onClose,
}: {
  invoice: ApartmentInvoice;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { data: documents } = useDocuments({ apartmentInvoiceId: invoice.id });
  const upload = useUploadDocument();
  const update = useUpdateApartmentInvoice();
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber ?? "");
  const [totalAmountRON, setTotalAmountRON] = useState(invoice.totalAmountRON);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category: "INVOICE", apartmentInvoiceId: invoice.id });
      toast.success("Document attached");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handleView(id: string, fileName: string) {
    setDownloading(true);
    try {
      await downloadDocument(id, fileName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: invoice.id,
        invoiceNumber: invoiceNumber || undefined,
        totalAmountRON: Number(totalAmountRON),
      });
      toast.success("Invoice updated");
      setEditing(false);
    } catch {
      toast.error("Could not update invoice");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {TYPE_LABEL[invoice.type]} invoice — {invoice.apartment?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5 text-[13.5px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusChip tone={paymentStatusTone(invoice.status)}>{invoice.status.replace("_", " ").toLowerCase()}</StatusChip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Invoice number</span>
            {editing ? (
              <Input className="w-36" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            ) : (
              <span>{invoice.invoiceNumber ?? "—"}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total amount</span>
            {editing ? (
              <Input
                className="w-36"
                type="number"
                step="0.01"
                value={totalAmountRON}
                onChange={(e) => setTotalAmountRON(e.target.value)}
              />
            ) : (
              <span className="font-mono-tabular font-mono">{formatRON(invoice.totalAmountRON)}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-mono-tabular font-mono">{formatRON(invoice.paidAmountRON)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-mono-tabular font-mono">{formatRON(invoice.outstandingAmountRON)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Issue date</span>
            <span>{dateFormatter.format(new Date(invoice.issueDate))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Due date</span>
            <span>{dateFormatter.format(new Date(invoice.dueDate))}</span>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>Document</Label>
            {documents && documents.data.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {documents.data.map((d) => (
                  <button
                    key={d.id}
                    disabled={downloading}
                    onClick={() => handleView(d.id, d.fileName)}
                    className="truncate rounded-md border border-border px-2.5 py-1.5 text-left text-[12.5px] hover:border-primary"
                  >
                    {d.fileName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">No document attached.</p>
            )}
            {canEdit && (
              <Input type="file" accept="image/*,application/pdf" onChange={handleFile} disabled={upload.isPending} />
            )}
          </div>
        </div>
        {canEdit && (
          <DialogFooter>
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Correct details
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ApplicationDraft {
  invoiceId: string;
  included: boolean;
  paidInFull: boolean;
  amount: string;
}

function RecordPaymentDialog({
  apartmentId,
  apartmentName,
  onClose,
}: {
  apartmentId: string;
  apartmentName: string;
  onClose: () => void;
}) {
  const { data: allInvoices, isLoading } = useApartmentInvoices({ apartmentId });
  const createPayment = useCreatePaymentConfirmation();
  const upload = useUploadDocument();
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ApplicationDraft>>({});
  const [error, setError] = useState<string | null>(null);

  const outstandingInvoices = useMemo(
    () =>
      (allInvoices?.data ?? [])
        .filter((inv) => inv.status !== "PAID")
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)),
    [allInvoices],
  );

  function draftFor(inv: ApartmentInvoice): ApplicationDraft {
    return drafts[inv.id] ?? { invoiceId: inv.id, included: false, paidInFull: false, amount: inv.outstandingAmountRON };
  }

  function updateDraft(inv: ApartmentInvoice, patch: Partial<ApplicationDraft>) {
    setDrafts((prev) => ({ ...prev, [inv.id]: { ...draftFor(inv), ...patch } }));
  }

  const total = outstandingInvoices.reduce((sum, inv) => {
    const d = draftFor(inv);
    if (!d.included) return sum;
    const amount = d.paidInFull ? Number(inv.outstandingAmountRON) : Number(d.amount || 0);
    return sum + amount;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const applications = outstandingInvoices
      .map((inv) => draftFor(inv))
      .filter((d) => d.included)
      .map((d) => ({
        invoiceId: d.invoiceId,
        paidInFull: d.paidInFull,
        amountRON: d.paidInFull ? undefined : Number(d.amount),
      }));

    if (applications.length === 0) {
      setError("Select at least one invoice this payment covers.");
      return;
    }

    try {
      const confirmation = await createPayment.mutateAsync({ apartmentId, paymentDate, notes: notes || undefined, applications });
      if (file) {
        await upload.mutateAsync({ file, category: "RECEIPT", paymentConfirmationId: confirmation.id });
      }
      toast.success("Payment recorded");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = createPayment.isPending || upload.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment — {apartmentName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Payment date</Label>
              <Input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment confirmation — optional</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Apply to invoices</Label>
            {isLoading ? (
              <p className="text-[13px] text-muted-foreground">Loading…</p>
            ) : outstandingInvoices.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No outstanding invoices for this apartment.</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-border p-2.5">
                {outstandingInvoices.map((inv) => {
                  const d = draftFor(inv);
                  return (
                    <div key={inv.id} className="flex flex-col gap-1.5 border-b border-border pb-2 last:border-0 last:pb-0">
                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={d.included}
                          onChange={(e) => updateDraft(inv, { included: e.target.checked })}
                        />
                        <span className="font-medium">{TYPE_LABEL[inv.type]}</span>
                        <span className="text-muted-foreground">
                          {monthLabel(inv.periodMonth.slice(0, 7))} · outstanding {formatRON(inv.outstandingAmountRON)}
                        </span>
                      </label>
                      {d.included && (
                        <div className="ml-6 flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-[12.5px]">
                            <input
                              type="checkbox"
                              checked={d.paidInFull}
                              onChange={(e) =>
                                updateDraft(inv, { paidInFull: e.target.checked, amount: inv.outstandingAmountRON })
                              }
                            />
                            Paid in full
                          </label>
                          {!d.paidInFull && (
                            <Input
                              type="number"
                              step="0.01"
                              max={inv.outstandingAmountRON}
                              className="h-8 w-28"
                              value={d.amount}
                              onChange={(e) => updateDraft(inv, { amount: e.target.value })}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Notes — optional</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-md bg-accent/40 px-3 py-2">
            <span className="text-[13px] text-muted-foreground">Total payment</span>
            <span className="font-mono-tabular font-mono text-[15px] font-semibold">{formatRON(total)}</span>
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || total <= 0}>
              {saving ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
