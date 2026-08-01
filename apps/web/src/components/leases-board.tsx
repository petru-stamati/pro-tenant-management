"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useLeases,
  useCreateLease,
  useUpdateLease,
  useRenewLease,
  useTerminateLease,
  type LeaseWithApartment,
} from "@/hooks/use-leases";
import { useApartments, type ApartmentSummary } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useCreateTenant } from "@/hooks/use-tenants";
import { useDocuments, useUploadDocument, downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, apartmentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatEUR, dateFormatter } from "@/lib/format";
import { withVat, withoutVat } from "@/lib/vat";
import { leaseTermStatus } from "@/lib/lease-status";

const STATUS_TONE = { DRAFT: "open", ACTIVE: "paid", ENDED: "progress", TERMINATED: "unpaid" } as const;

function monthsBetween(start: string, end: string): number {
  if (!start || !end) return 12;
  const s = new Date(start);
  const e = new Date(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(1, months);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || parts[0] };
}

export function LeasesBoard({ canManage }: { canManage: boolean }) {
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: owners } = useOwners();
  const { data: activeLeases, isLoading: leasesLoading } = useLeases({ status: "ACTIVE" });
  const [documentsFor, setDocumentsFor] = useState<LeaseWithApartment | null>(null);

  const leaseByApartmentId = useMemo(() => {
    const map = new Map<string, LeaseWithApartment>();
    activeLeases?.data.forEach((l) => map.set(l.apartmentId, l));
    return map;
  }, [activeLeases]);

  const vacantApartments = useMemo(
    () => apartments?.data.filter((a) => a.status === "VACANT") ?? [],
    [apartments],
  );

  const ownerName = (ownerId: string | undefined) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";
  const isLoading = apartmentsLoading || leasesLoading;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Leases</h1>
          <p className="text-[13.5px] text-muted-foreground">{apartments?.data.length ?? 0} units</p>
        </div>
        <AddLeaseDialog vacantApartments={vacantApartments} />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : apartments && apartments.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Apartment</th>
                <th className="p-3 font-medium text-muted-foreground">Tenant</th>
                <th className="p-3 font-medium text-muted-foreground">Term</th>
                <th className="p-3 font-medium text-muted-foreground">Rent</th>
                <th className="p-3 font-medium text-muted-foreground">Deposit</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apartments.data.map((a) => {
                const lease = leaseByApartmentId.get(a.id);
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{ownerName(a.ownerId)}</div>
                    </td>
                    <td className="p-3">
                      {lease?.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : "—"}
                    </td>
                    <td className="p-3">
                      {lease ? (
                        <>
                          <div className="font-mono-tabular font-mono text-[12.5px]">
                            {dateFormatter.format(new Date(lease.startDate))} → {dateFormatter.format(new Date(lease.endDate))}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {lease.termMonths ?? monthsBetween(lease.startDate, lease.endDate)} months
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {lease ? (
                        <>
                          <div className="font-mono-tabular font-mono text-[13px]">
                            {formatEUR(withVat(lease.rentAmountEUR, lease.rentVatIncluded))}{" "}
                            <span className="text-[11px] text-muted-foreground">VAT incl.</span>
                          </div>
                          <div className="font-mono-tabular font-mono text-[11.5px] text-muted-foreground">
                            {formatEUR(withoutVat(lease.rentAmountEUR, lease.rentVatIncluded))} excl. VAT
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 font-mono-tabular font-mono">
                      {lease ? formatEUR(lease.depositAmountEUR) : "—"}
                    </td>
                    <td className="p-3">
                      {lease ? (
                        lease.status === "ACTIVE" ? (
                          (() => {
                            const term = leaseTermStatus(lease.endDate, lease.autoRenewal);
                            return <StatusChip tone={term.tone}>{term.label}</StatusChip>;
                          })()
                        ) : (
                          <StatusChip tone={STATUS_TONE[lease.status]}>{lease.status.toLowerCase()}</StatusChip>
                        )
                      ) : (
                        <StatusChip tone={apartmentStatusTone("VACANT")}>vacant</StatusChip>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5">
                        {lease && (
                          <Button variant="outline" size="sm" onClick={() => setDocumentsFor(lease)}>
                            View rental agreement
                          </Button>
                        )}
                        {canManage && lease && <LeaseActions lease={lease} />}
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

      {documentsFor && <LeaseDocumentDialog lease={documentsFor} onClose={() => setDocumentsFor(null)} />}
    </div>
  );
}

function LeaseDocumentDialog({ lease, onClose }: { lease: LeaseWithApartment; onClose: () => void }) {
  const { data: documents, isLoading } = useDocuments({ leaseId: lease.id });
  const upload = useUploadDocument();
  const [downloading, setDownloading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category: "CONTRACT", leaseId: lease.id });
      toast.success("Rental agreement uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handleDownload(id: string, fileName: string) {
    setDownloading(true);
    try {
      await downloadDocument(id, fileName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rental agreement — {lease.apartment.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : documents && documents.data.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {documents.data.map((d) => (
                <button
                  key={d.id}
                  disabled={downloading}
                  onClick={() => handleDownload(d.id, d.fileName)}
                  className="truncate rounded-md border border-border px-2.5 py-1.5 text-left text-[12.5px] hover:border-primary"
                >
                  {d.fileName}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No rental agreement uploaded yet.</p>
          )}
          <label className="flex cursor-pointer flex-col gap-2">
            <Label>Upload rental agreement</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={handleFile} disabled={upload.isPending} />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaseActions({ lease }: { lease: LeaseWithApartment }) {
  const [mode, setMode] = useState<"edit" | "renew" | "terminate" | null>(null);
  const update = useUpdateLease(lease.id);
  const renew = useRenewLease(lease.id);
  const terminate = useTerminateLease(lease.id);
  const upload = useUploadDocument();
  const [editForm, setEditForm] = useState({ rentVatIncluded: lease.rentVatIncluded, autoRenewal: lease.autoRenewal });
  const [renewForm, setRenewForm] = useState({ startDate: "", endDate: "", rentAmountEUR: lease.rentAmountEUR });
  const [renewalFile, setRenewalFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync(editForm);
      toast.success("Lease updated");
      setMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const renewed = await renew.mutateAsync({
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        rentAmountEUR: Number(renewForm.rentAmountEUR),
      });
      if (renewalFile) {
        await upload.mutateAsync({ file: renewalFile, category: "RENEWAL", leaseId: renewed.id });
      }
      toast.success("Lease renewed");
      setRenewalFile(null);
      setMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleTerminate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await terminate.mutateAsync(reason);
      toast.success("Lease terminated");
      setMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Dialog open={mode === "edit"} onOpenChange={(v) => setMode(v ? "edit" : null)}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Edit</DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit lease terms — {lease.apartment.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            <label className="flex items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={editForm.rentVatIncluded}
                onChange={(e) => setEditForm((f) => ({ ...f, rentVatIncluded: e.target.checked }))}
              />
              Rent amount is VAT incl.
            </label>
            <label className="flex items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={editForm.autoRenewal}
                onChange={(e) => setEditForm((f) => ({ ...f, autoRenewal: e.target.checked }))}
              />
              Auto-renewal clause
            </label>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode === "renew"}
        onOpenChange={(v) => {
          setMode(v ? "renew" : null);
          if (!v) setRenewalFile(null);
        }}
      >
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Renew</DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renew lease — {lease.apartment.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenew} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  required
                  value={renewForm.startDate}
                  onChange={(e) => setRenewForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  required
                  value={renewForm.endDate}
                  onChange={(e) => setRenewForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Rent (EUR, VAT incl.)</Label>
              <Input
                type="number"
                required
                value={renewForm.rentAmountEUR}
                onChange={(e) => setRenewForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
              />
            </div>
            <label className="flex cursor-pointer flex-col gap-2">
              <Label>Signed addendum / extension — optional</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setRenewalFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={renew.isPending || upload.isPending}>
                {renew.isPending || upload.isPending ? "Renewing…" : "Renew lease"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "terminate"} onOpenChange={(v) => setMode(v ? "terminate" : null)}>
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>Terminate</DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Terminate lease — {lease.apartment.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTerminate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Reason</Label>
              <Input required value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={terminate.isPending}>
                {terminate.isPending ? "Terminating…" : "Terminate lease"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddLeaseDialog({ vacantApartments }: { vacantApartments: ApartmentSummary[] }) {
  const [open, setOpen] = useState(false);
  const createTenant = useCreateTenant();
  const createLease = useCreateLease();
  const upload = useUploadDocument();
  const [apartmentId, setApartmentId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [termMonths, setTermMonths] = useState("12");
  const [rentAmountEUR, setRentAmountEUR] = useState("");
  const [rentVatIncluded, setRentVatIncluded] = useState(true);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [depositAmountEUR, setDepositAmountEUR] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDatesChange(nextStart: string, nextEnd: string) {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    if (nextStart && nextEnd) setTermMonths(String(monthsBetween(nextStart, nextEnd)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { firstName, lastName } = splitName(tenantName);
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "tenant";
      const tenant = await createTenant.mutateAsync({
        firstName,
        lastName,
        email: `${slug}.${Date.now()}@placeholder.tenant`,
      });

      const lease = await createLease.mutateAsync({
        apartmentId,
        tenantId: tenant.id,
        startDate,
        endDate,
        rentAmountEUR: Number(rentAmountEUR),
        rentVatIncluded,
        termMonths: termMonths ? Number(termMonths) : undefined,
        autoRenewal,
        depositAmountEUR: Number(depositAmountEUR),
        status: "ACTIVE",
      });

      if (file) {
        await upload.mutateAsync({ file, category: "CONTRACT", leaseId: lease.id });
      }

      toast.success("Lease created");
      setOpen(false);
      setApartmentId("");
      setTenantName("");
      setStartDate("");
      setEndDate("");
      setTermMonths("12");
      setRentAmountEUR("");
      setRentVatIncluded(true);
      setAutoRenewal(false);
      setDepositAmountEUR("");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = createTenant.isPending || createLease.isPending || upload.isPending;
  const noVacancy = vacantApartments.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Add lease</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add lease</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>Apartment</Label>
            <Select value={apartmentId} onValueChange={(v) => setApartmentId(v ?? "")} disabled={noVacancy}>
              <SelectTrigger>
                <SelectValue placeholder={noVacancy ? "No vacant apartments" : "Select a vacant apartment"} />
              </SelectTrigger>
              <SelectContent>
                {vacantApartments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {noVacancy && (
              <p className="text-[11.5px] text-muted-foreground">
                Every unit is occupied — terminate a lease before adding a new one.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tenant name</Label>
            <Input required value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Start date</Label>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleDatesChange(e.target.value, endDate)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Expiry date</Label>
              <Input type="date" required value={endDate} onChange={(e) => handleDatesChange(startDate, e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Term (months)</Label>
            <Input type="number" min={1} required value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <input type="checkbox" checked={autoRenewal} onChange={(e) => setAutoRenewal(e.target.checked)} />
              Auto-renewal clause (renews automatically unless either party gives notice before the end date)
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Rent (EUR)</Label>
              <Input type="number" required value={rentAmountEUR} onChange={(e) => setRentAmountEUR(e.target.value)} />
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <input type="checkbox" checked={rentVatIncluded} onChange={(e) => setRentVatIncluded(e.target.checked)} />
                VAT incl.
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Security deposit (EUR)</Label>
              <Input
                type="number"
                required
                value={depositAmountEUR}
                onChange={(e) => setDepositAmountEUR(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rental agreement — optional</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || noVacancy || !apartmentId}>
              {saving ? "Saving…" : "Create lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
