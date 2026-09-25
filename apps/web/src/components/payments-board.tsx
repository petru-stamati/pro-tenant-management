"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon, ChevronRightIcon, UploadIcon } from "lucide-react";
import {
  useApartmentInvoices,
  useCreateApartmentInvoice,
  useUpdateApartmentInvoice,
  type ApartmentInvoice,
  type ApartmentInvoiceType,
} from "@/hooks/use-apartment-invoices";
import { useCreatePaymentConfirmation, type PaymentMethod } from "@/hooks/use-payment-confirmations";
import { useApartments, useApartment } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useDocuments, useUploadDocument, useDeleteDocument, downloadDocument } from "@/hooks/use-documents";
import { UploadInvoicesDialog, ReviewInvoicesDialog } from "@/components/invoice-upload-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatRON, dateFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

export const TYPE_LABEL: Record<ApartmentInvoiceType, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  RENT_AND_UTILITIES: "Rent + Utilities",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function FilterPill({
  active,
  onClick,
  destructive,
  children,
}: {
  active: boolean;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? destructive
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-foreground bg-foreground text-background"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function PaymentsBoard({
  canRecordPayments,
  role,
}: {
  canRecordPayments: boolean;
  role: "PM" | "OWNER";
}) {
  const [month, setMonth] = useState(currentMonth());
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: owners } = useOwners();
  const { data: invoices, isLoading: invoicesLoading } = useApartmentInvoices({ month });
  const { data: outstandingInvoices } = useApartmentInvoices({ outstandingOnly: true });
  const [uploadFor, setUploadFor] = useState<{ id: string; name: string } | null>(null);
  const [paymentFor, setPaymentFor] = useState<{ id: string; name: string } | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ApartmentInvoice | null>(null);
  const [quickRegister, setQuickRegister] = useState(false);
  const [uploadInvoices, setUploadInvoices] = useState(false);
  const [reviewInvoices, setReviewInvoices] = useState(false);

  const invoicesByApartment = useMemo(() => {
    const map = new Map<string, ApartmentInvoice[]>();
    invoices?.data.forEach((inv) => {
      const list = map.get(inv.apartmentId) ?? [];
      list.push(inv);
      map.set(inv.apartmentId, list);
    });
    return map;
  }, [invoices]);

  // All-time outstanding, not just this month's invoices — a July balance
  // doesn't vanish from the board just because we've paged to August.
  const outstandingByApartment = useMemo(() => {
    const map = new Map<string, ApartmentInvoice[]>();
    outstandingInvoices?.data.forEach((inv) => {
      const list = map.get(inv.apartmentId) ?? [];
      list.push(inv);
      map.set(inv.apartmentId, list);
    });
    return map;
  }, [outstandingInvoices]);

  const ownerName = (ownerId: string | undefined) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";
  const isLoading = apartmentsLoading || invoicesLoading;
  const now = Date.now();

  const [rowFilter, setRowFilter] = useState<"ALL" | "OUTSTANDING" | "OVERDUE" | "NO_INVOICE">("ALL");

  const kpis = useMemo(() => {
    const invoicedTotal = (invoices?.data ?? []).reduce((sum, inv) => sum + Number(inv.totalAmountRON), 0);
    const collectedTotal = (invoices?.data ?? []).reduce((sum, inv) => sum + Number(inv.paidAmountRON), 0);
    const outstandingAllMonths = (outstandingInvoices?.data ?? []).reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0);
    const overdueCount = (outstandingInvoices?.data ?? []).filter((inv) => new Date(inv.dueDate).getTime() < now).length;
    const notYetDueCount = (outstandingInvoices?.data.length ?? 0) - overdueCount;
    const standingCredit = (apartments?.data ?? []).reduce((sum, a) => sum + Number(a.creditBalanceRON), 0);
    return {
      invoicedTotal,
      invoicedCount: invoices?.data.length ?? 0,
      collectedTotal,
      outstandingAllMonths,
      overdueCount,
      notYetDueCount,
      standingCredit,
    };
  }, [invoices, outstandingInvoices, apartments, now]);

  const rows = useMemo(() => {
    const all = apartments?.data ?? [];
    return all.filter((a) => {
      const apartmentInvoices = invoicesByApartment.get(a.id) ?? [];
      const apartmentOutstanding = outstandingByApartment.get(a.id) ?? [];
      if (rowFilter === "ALL") return true;
      if (rowFilter === "NO_INVOICE") return apartmentInvoices.length === 0;
      if (rowFilter === "OUTSTANDING") return apartmentOutstanding.length > 0;
      if (rowFilter === "OVERDUE") return apartmentOutstanding.some((inv) => new Date(inv.dueDate).getTime() < now);
      return true;
    });
  }, [apartments, invoicesByApartment, outstandingByApartment, rowFilter, now]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-1 font-mono text-[12px] font-medium tracking-[1px] text-muted-foreground uppercase">
        {apartments?.data.length ?? 0} apartments · all amounts VAT incl.
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-[23px] font-semibold">Payments</h1>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-[140px] px-2 text-center text-[13px] font-medium">{monthLabel(month)}</div>
            <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-md p-1.5 hover:bg-muted">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          {month !== currentMonth() && (
            <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {role === "OWNER" && (
            <Button variant="outline" onClick={() => setUploadInvoices(true)}>
              + Upload invoices
            </Button>
          )}
          {role === "PM" && (
            <Button variant="outline" onClick={() => setReviewInvoices(true)}>
              Invoices to assign
            </Button>
          )}
          {canRecordPayments && <Button onClick={() => setQuickRegister(true)}>+ Register payment</Button>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 divide-x divide-divider overflow-hidden rounded-[16px] border border-border bg-card shadow-sm sm:grid-cols-4">
        <div className="flex flex-col gap-1 px-4 py-3.5">
          <span className="text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Invoiced</span>
          <span className="font-mono-tabular font-mono text-[19px] font-semibold">{formatRON(kpis.invoicedTotal)}</span>
          <span className="text-[11px] text-muted-foreground">{kpis.invoicedCount} invoices</span>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5">
          <span className="text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Collected</span>
          <span className="font-mono-tabular font-mono text-[19px] font-semibold">{formatRON(kpis.collectedTotal)}</span>
          {kpis.invoicedTotal > 0 && (
            <div className="h-1 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (kpis.collectedTotal / kpis.invoicedTotal) * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 bg-[#fdf8f7] px-4 py-3.5">
          <span className="text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Outstanding, all months</span>
          <span className="font-mono-tabular font-mono text-[19px] font-semibold text-destructive">{formatRON(kpis.outstandingAllMonths)}</span>
          <span className="text-[11px] text-muted-foreground">
            {kpis.overdueCount} overdue · {kpis.notYetDueCount} not yet due
          </span>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5">
          <span className="text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Standing credit</span>
          <span className="font-mono-tabular font-mono text-[19px] font-semibold text-primary">{formatRON(kpis.standingCredit)}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={rowFilter === "ALL"} onClick={() => setRowFilter("ALL")}>
          All
        </FilterPill>
        <FilterPill active={rowFilter === "OUTSTANDING"} onClick={() => setRowFilter("OUTSTANDING")}>
          Outstanding
        </FilterPill>
        <FilterPill active={rowFilter === "OVERDUE"} onClick={() => setRowFilter("OVERDUE")} destructive>
          Overdue
        </FilterPill>
        <FilterPill active={rowFilter === "NO_INVOICE"} onClick={() => setRowFilter("NO_INVOICE")}>
          No invoice yet
        </FilterPill>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Tenant</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Invoices this month</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Outstanding</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const apartmentInvoices = invoicesByApartment.get(a.id) ?? [];
                const apartmentOutstanding = outstandingByApartment.get(a.id) ?? [];
                const outstandingTotal = apartmentOutstanding.reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0);
                const outstandingByMonth = [...apartmentOutstanding]
                  .reduce((map, inv) => {
                    const key = inv.periodMonth.slice(0, 7);
                    map.set(key, (map.get(key) ?? 0) + Number(inv.outstandingAmountRON));
                    return map;
                  }, new Map<string, number>());
                const outstandingBreakdown = [...outstandingByMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
                return (
                  <tr key={a.id} className="border-b border-divider last:border-0 align-top">
                    <td className="p-3">
                      <div className="font-medium">
                        {a.currentLease?.tenant ? `${a.currentLease.tenant.firstName} ${a.currentLease.tenant.lastName}` : a.name}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {a.currentLease?.tenant ? `${a.name} · ${ownerName(a.ownerId)}` : ownerName(a.ownerId)}
                      </div>
                    </td>
                    <td className="p-3">
                      {apartmentInvoices.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {apartmentInvoices.map((inv) => (
                            <button
                              key={inv.id}
                              onClick={() => setDetailInvoice(inv)}
                              className="rounded-[10px] border border-border bg-[#fbfbfa] px-2.5 py-1.5 text-left text-[12px] hover:border-primary"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{TYPE_LABEL[inv.type]}</span>
                                <StatusChip tone={paymentStatusTone(inv.status)}>
                                  {inv.status.replace("_", " ").toLowerCase()}
                                </StatusChip>
                              </div>
                              <div className="font-mono-tabular font-mono font-semibold">{formatRON(inv.totalAmountRON)}</div>
                              <div className="font-mono text-[10.5px] text-muted-foreground">
                                due {dateFormatter.format(new Date(inv.dueDate))}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setUploadFor({ id: a.id, name: a.name })}
                          className="rounded-[10px] border border-dashed border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          No invoice yet · Upload
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      {outstandingTotal > 0 ? (
                        <div>
                          <div className="font-mono-tabular font-mono text-destructive">{formatRON(outstandingTotal)}</div>
                          {outstandingBreakdown.length > 1 && (
                            <div className="mt-0.5 flex flex-col gap-0.5">
                              {outstandingBreakdown.map(([m, amt]) => (
                                <span key={m} className="font-mono text-[10.5px] text-muted-foreground">
                                  {monthLabel(m)}: {formatRON(amt)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono-tabular font-mono">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setUploadFor({ id: a.id, name: a.name })}
                          title="Upload invoice"
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-foreground"
                        >
                          <UploadIcon className="h-4 w-4" />
                        </button>
                        {canRecordPayments && (
                          <Button size="sm" className="bg-foreground text-background hover:bg-foreground/85" onClick={() => setPaymentFor({ id: a.id, name: a.name })}>
                            Record
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
          <p className="p-5 text-sm text-muted-foreground">No apartments match this filter.</p>
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
      {quickRegister && <RegisterPaymentDialog onClose={() => setQuickRegister(false)} />}
      {uploadInvoices && <UploadInvoicesDialog onClose={() => setUploadInvoices(false)} />}
      {reviewInvoices && <ReviewInvoicesDialog onClose={() => setReviewInvoices(false)} />}
    </div>
  );
}

/** Entry point that doesn't already have an apartment in context (PM dashboard, Payments tab header)
 *  — picks the apartment first, then falls through to the normal RecordPaymentDialog. */
export function RegisterPaymentDialog({ onClose }: { onClose: () => void }) {
  const { data: apartments, isLoading } = useApartments();
  const [apartmentId, setApartmentId] = useState("");

  const selected = apartments?.data.find((a) => a.id === apartmentId);
  if (selected) {
    return <RecordPaymentDialog apartmentId={selected.id} apartmentName={selected.name} onClose={onClose} />;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Register payment</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>Apartment</Label>
          {isLoading ? (
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          ) : (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Applied from credit balance",
};

export function InvoiceDetailDialog({
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
  const deleteDocument = useDeleteDocument();
  const [type, setType] = useState<ApartmentInvoiceType>(invoice.type);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber ?? "");
  const [issueDate, setIssueDate] = useState(invoice.issueDate.slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));
  const [periodMonth, setPeriodMonth] = useState(invoice.periodMonth.slice(0, 7));
  const [totalAmountRON, setTotalAmountRON] = useState(invoice.totalAmountRON);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const paymentHistory = useMemo(
    () => [...(invoice.applications ?? [])].sort((a, b) => b.paymentConfirmation.paymentDate.localeCompare(a.paymentConfirmation.paymentDate)),
    [invoice.applications],
  );

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

  async function handleDeleteDocument(id: string) {
    if (!window.confirm("Delete this document? This can't be undone.")) return;
    try {
      await deleteDocument.mutateAsync(id);
      toast.success("Document deleted");
    } catch {
      toast.error("Could not delete document");
    }
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: invoice.id,
        type,
        invoiceNumber: invoiceNumber || undefined,
        issueDate,
        dueDate,
        periodMonth: `${periodMonth}-01`,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {TYPE_LABEL[invoice.type]} invoice —{" "}
            {invoice.apartment?.currentLease?.tenant
              ? `${invoice.apartment.currentLease.tenant.firstName} ${invoice.apartment.currentLease.tenant.lastName}`
              : invoice.apartment?.name}
          </DialogTitle>
          {invoice.apartment?.currentLease?.tenant && (
            <p className="text-[12px] text-muted-foreground">{invoice.apartment.name}</p>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-3.5 text-[13.5px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusChip tone={paymentStatusTone(invoice.status)}>{invoice.status.replace("_", " ").toLowerCase()}</StatusChip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type</span>
            {editing ? (
              <Select value={type} onValueChange={(v) => setType((v as ApartmentInvoiceType) ?? "RENT")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RENT">Rent</SelectItem>
                  <SelectItem value="UTILITIES">Utilities</SelectItem>
                  <SelectItem value="RENT_AND_UTILITIES">Rent + Utilities</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span>{TYPE_LABEL[invoice.type]}</span>
            )}
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
              <span className="font-mono-tabular font-mono">
                {formatRON(invoice.totalAmountRON)} <span className="text-[10px] text-muted-foreground">VAT incl.</span>
              </span>
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
            {editing ? (
              <Input className="w-36" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            ) : (
              <span>{dateFormatter.format(new Date(invoice.issueDate))}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Due date</span>
            {editing ? (
              <Input className="w-36" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            ) : (
              <span>{dateFormatter.format(new Date(invoice.dueDate))}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Billing month</span>
            {editing ? (
              <Input className="w-36" type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            ) : (
              <span>{monthLabel(invoice.periodMonth.slice(0, 7))}</span>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>Payment history</Label>
            {paymentHistory.length > 0 ? (
              <div className="flex flex-col gap-2">
                {paymentHistory.map((app) => (
                  <div key={app.id} className="rounded-md border border-border p-2.5 text-[12.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatRON(app.amountRON)}</span>
                      <span className="text-muted-foreground">
                        {dateFormatter.format(new Date(app.paymentConfirmation.paymentDate))}
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {PAYMENT_METHOD_LABEL[app.paymentConfirmation.paymentMethod] ?? app.paymentConfirmation.paymentMethod}
                    </div>
                    {app.paymentConfirmation.documents && app.paymentConfirmation.documents.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {app.paymentConfirmation.documents.map((d) => (
                          <div key={d.id} className="flex items-center gap-1">
                            <button
                              disabled={downloading}
                              onClick={() => handleView(d.id, d.fileName)}
                              className="flex-1 truncate rounded-md border border-border px-2 py-1 text-left text-[11.5px] hover:border-primary"
                            >
                              {d.fileName}
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                disabled={deleteDocument.isPending}
                                onClick={() => handleDeleteDocument(d.id)}
                                className="rounded-md border border-border px-2 py-1 text-[11.5px] text-destructive hover:border-destructive"
                                title="Delete document"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">No payments recorded against this invoice yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>Invoice document</Label>
            {documents && documents.data.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {documents.data.map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <button
                      disabled={downloading}
                      onClick={() => handleView(d.id, d.fileName)}
                      className="flex-1 truncate rounded-md border border-border px-2.5 py-1.5 text-left text-[12.5px] hover:border-primary"
                    >
                      {d.fileName}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={deleteDocument.isPending}
                        onClick={() => handleDeleteDocument(d.id)}
                        className="rounded-md border border-border px-2.5 py-1.5 text-[12.5px] text-destructive hover:border-destructive"
                        title="Delete document"
                      >
                        ×
                      </button>
                    )}
                  </div>
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
  const { data: apartment } = useApartment(apartmentId);
  const createPayment = useCreatePaymentConfirmation();
  const upload = useUploadDocument();
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ApplicationDraft>>({});
  const [autoApply, setAutoApply] = useState(true);
  const [autoApplyAmount, setAutoApplyAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const outstandingInvoices = useMemo(
    () =>
      (allInvoices?.data ?? [])
        .filter((inv) => inv.status !== "PAID")
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)),
    [allInvoices],
  );

  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0);
  const creditBalance = Number(apartment?.creditBalanceRON ?? 0);

  function draftFor(inv: ApartmentInvoice): ApplicationDraft {
    return drafts[inv.id] ?? { invoiceId: inv.id, included: false, paidInFull: false, amount: inv.outstandingAmountRON };
  }

  function updateDraft(inv: ApartmentInvoice, patch: Partial<ApplicationDraft>) {
    setDrafts((prev) => ({ ...prev, [inv.id]: { ...draftFor(inv), ...patch } }));
  }

  const manualTotal = outstandingInvoices.reduce((sum, inv) => {
    const d = draftFor(inv);
    if (!d.included) return sum;
    const amount = d.paidInFull ? Number(inv.outstandingAmountRON) : Number(d.amount || 0);
    return sum + amount;
  }, 0);

  const total = autoApply ? Number(autoApplyAmount || 0) : manualTotal;
  const willCreateCredit = autoApply && Number(autoApplyAmount || 0) > totalOutstanding;

  // Client-side-only simulation of what auto-apply would do with the amount
  // typed so far — oldest invoice first — so the PM can see where the money
  // is headed before submitting. Doesn't affect what's actually sent.
  const autoApplyPreview = useMemo(() => {
    if (!autoApply) return [];
    let remaining = Number(autoApplyAmount || 0);
    const lines: { invoice: ApartmentInvoice; allocated: number; tag: "PAID IN FULL" | "PARTIAL" | "UNTOUCHED" }[] = [];
    for (const inv of outstandingInvoices) {
      const owed = Number(inv.outstandingAmountRON);
      if (remaining <= 0) {
        lines.push({ invoice: inv, allocated: 0, tag: "UNTOUCHED" });
        continue;
      }
      const allocated = Math.min(remaining, owed);
      remaining -= allocated;
      lines.push({ invoice: inv, allocated, tag: allocated >= owed ? "PAID IN FULL" : "PARTIAL" });
    }
    return lines;
  }, [autoApply, autoApplyAmount, outstandingInvoices]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (autoApply) {
      if (!autoApplyAmount || Number(autoApplyAmount) <= 0) {
        setError("Enter the amount that was paid.");
        return;
      }
    }

    const applications = autoApply
      ? undefined
      : outstandingInvoices
          .map((inv) => draftFor(inv))
          .filter((d) => d.included)
          .map((d) => ({
            invoiceId: d.invoiceId,
            paidInFull: d.paidInFull,
            amountRON: d.paidInFull ? undefined : Number(d.amount),
          }));

    if (!autoApply && (!applications || applications.length === 0)) {
      setError("Select at least one invoice this payment covers.");
      return;
    }
    try {
      const confirmation = await createPayment.mutateAsync({
        apartmentId,
        paymentDate,
        paymentMethod,
        notes: notes || undefined,
        ...(autoApply ? { autoApplyAmountRON: Number(autoApplyAmount) } : { applications }),
      });
      if (file) {
        await upload.mutateAsync({ file, category: "RECEIPT", paymentConfirmationId: confirmation.id });
      }
      toast.success(paymentMethod === "CASH" ? "Payment recorded — task created to hand over cash to the Owner" : "Payment recorded");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = createPayment.isPending || upload.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
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
              <Label>How was it paid?</Label>
              <div className="flex rounded-[10px] border border-border p-0.5">
                {(["BANK_TRANSFER", "CASH"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      setFile(null);
                    }}
                    className={cn(
                      "h-8 flex-1 rounded-[8px] text-[12.5px] font-medium transition-colors",
                      paymentMethod === m ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {m === "BANK_TRANSFER" ? "Bank transfer" : "Cash"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {paymentMethod === "BANK_TRANSFER" ? (
            <div className="flex flex-col gap-2">
              <Label>Proof of transfer (OP) — optional</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          ) : (
            <p className="rounded-md bg-accent/40 px-3 py-2 text-[12.5px] text-muted-foreground">
              A task will be created to hand this cash over to the Owner — it'll show up in both your Tasks tab and theirs.
            </p>
          )}

          {creditBalance > 0 && (
            <p className="rounded-md bg-accent/40 px-3 py-2 text-[12.5px] text-muted-foreground">
              This apartment has {formatRON(creditBalance)} in standing credit from a prior overpayment — it'll be applied
              automatically the next time an invoice is created.
            </p>
          )}

          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
            Auto-apply to oldest outstanding invoices first
          </label>

          {autoApply ? (
            <div className="flex flex-col gap-2">
              <Label>Amount paid (RON)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={autoApplyAmount}
                onChange={(e) => setAutoApplyAmount(e.target.value)}
                className="h-[52px] font-mono-tabular font-mono text-[22px] focus-visible:ring-primary/12 focus-visible:ring-4"
              />
              {isLoading ? (
                <p className="text-[12.5px] text-muted-foreground">Loading outstanding invoices…</p>
              ) : totalOutstanding > 0 ? (
                <p className="text-[12.5px] text-muted-foreground">
                  Outstanding across {outstandingInvoices.length} invoice{outstandingInvoices.length === 1 ? "" : "s"}:{" "}
                  {formatRON(totalOutstanding)}
                </p>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">No outstanding invoices — the full amount will be saved as credit.</p>
              )}

              {Number(autoApplyAmount || 0) > 0 && autoApplyPreview.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                  <Label className="text-[11px] text-muted-foreground">Where it goes</Label>
                  {autoApplyPreview.map(({ invoice, allocated, tag }) => (
                    <div key={invoice.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted-foreground">
                        {TYPE_LABEL[invoice.type]} · {monthLabel(invoice.periodMonth.slice(0, 7))}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular font-mono">{formatRON(allocated)}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide uppercase",
                            tag === "PAID IN FULL" && "bg-accent text-accent-foreground",
                            tag === "PARTIAL" && "bg-warning-soft text-warning-ink",
                            tag === "UNTOUCHED" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {willCreateCredit && (
                <p className="rounded-md bg-accent/40 px-3 py-2 text-[12.5px] text-muted-foreground">
                  {formatRON(Number(autoApplyAmount) - totalOutstanding)} more than what's outstanding — the difference will
                  be saved as credit for this apartment and applied to its next invoice automatically.
                </p>
              )}
            </div>
          ) : (
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
          )}

          <div className="flex flex-col gap-2">
            <Label>Notes — optional</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-md bg-accent/40 px-3 py-2">
            <span className="text-[13px] text-muted-foreground">Total payment</span>
            <span className="font-mono-tabular font-mono text-[18px] font-semibold">{formatRON(total)}</span>
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
