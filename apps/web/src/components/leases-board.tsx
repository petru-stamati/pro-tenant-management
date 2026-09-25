"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileTextIcon, MoreHorizontalIcon } from "lucide-react";
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
import { useCreateTenant, useUpdateTenant } from "@/hooks/use-tenants";
import { useDocuments, useUploadDocument, downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatEUR, dateFormatter } from "@/lib/format";
import { withVat, withoutVat } from "@/lib/vat";
import { leaseTermStatus } from "@/lib/lease-status";
import { cn } from "@/lib/utils";

const STATUS_TONE = { DRAFT: "open", ACTIVE: "paid", ENDED: "progress", TERMINATED: "unpaid" } as const;

function daysLeft(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.round(
    (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
}

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

type LeaseFilter = "ALL" | "ACTIVE" | "ENDING_SOON" | "VACANT";

export function LeasesBoard({ canManage }: { canManage: boolean }) {
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: owners } = useOwners();
  const { data: activeLeases, isLoading: leasesLoading } = useLeases({ status: "ACTIVE" });
  const [documentsFor, setDocumentsFor] = useState<LeaseWithApartment | null>(null);
  const [filter, setFilter] = useState<LeaseFilter>("ALL");

  const leaseByApartmentId = useMemo(() => {
    const map = new Map<string, LeaseWithApartment>();
    activeLeases?.data.forEach((l) => map.set(l.apartmentId, l));
    return map;
  }, [activeLeases]);

  const vacantApartments = useMemo(
    () => apartments?.data.filter((a) => a.status === "VACANT") ?? [],
    [apartments],
  );

  const counts = useMemo(() => {
    const active = activeLeases?.data.length ?? 0;
    const endingSoon = (activeLeases?.data ?? []).filter((l) => daysLeft(l.endDate) <= 90 && daysLeft(l.endDate) >= 0).length;
    return { active, endingSoon, vacant: vacantApartments.length };
  }, [activeLeases, vacantApartments]);

  const rows = useMemo(() => {
    const all = apartments?.data ?? [];
    return all.filter((a) => {
      const lease = leaseByApartmentId.get(a.id);
      if (filter === "ALL") return true;
      if (filter === "VACANT") return !lease;
      if (filter === "ACTIVE") return !!lease;
      if (filter === "ENDING_SOON") return !!lease && daysLeft(lease.endDate) <= 90 && daysLeft(lease.endDate) >= 0;
      return true;
    });
  }, [apartments, leaseByApartmentId, filter]);

  const ownerName = (ownerId: string | undefined) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";
  const isLoading = apartmentsLoading || leasesLoading;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-1 font-mono text-[12px] font-medium tracking-[1px] text-muted-foreground uppercase">
        {counts.active} active · {counts.endingSoon} ending within 90 days · {counts.vacant} vacant
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-[23px] font-semibold">Leases</h1>
        {canManage && <AddLeaseDialog vacantApartments={vacantApartments} />}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All units
        </FilterButton>
        <FilterButton active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")}>
          Active
        </FilterButton>
        <FilterButton active={filter === "ENDING_SOON"} onClick={() => setFilter("ENDING_SOON")}>
          Ending soon
        </FilterButton>
        <FilterButton active={filter === "VACANT"} onClick={() => setFilter("VACANT")}>
          Vacant
        </FilterButton>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Apartment</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Tenant</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Term</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Rent</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Deposit</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Status</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const lease = leaseByApartmentId.get(a.id);
                const left = lease ? daysLeft(lease.endDate) : null;
                const total = lease ? lease.termMonths ?? monthsBetween(lease.startDate, lease.endDate) : 0;
                const elapsedPct = lease
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((Date.now() - new Date(lease.startDate).getTime()) /
                          (new Date(lease.endDate).getTime() - new Date(lease.startDate).getTime())) *
                          100,
                      ),
                    )
                  : 0;
                const barColor = left === null ? "bg-muted" : left < 30 ? "bg-destructive" : left < 90 ? "bg-warning" : "bg-primary";
                return (
                  <tr key={a.id} className="border-b border-divider last:border-0 align-top">
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{ownerName(a.ownerId)}</div>
                    </td>
                    <td className="p-3">
                      {lease?.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : "—"}
                    </td>
                    <td className="p-3 min-w-[180px]">
                      {lease ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                            <span>{dateFormatter.format(new Date(lease.startDate))}</span>
                            <span className="font-medium text-foreground">
                              {left !== null && left >= 0 ? `${left}d left` : `${total} mo`}
                            </span>
                            <span>{dateFormatter.format(new Date(lease.endDate))}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${elapsedPct}%` }} />
                          </div>
                        </div>
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
                        <StatusChip tone={apartmentStatusTone(a.status)}>{apartmentStatusLabel(a.status)}</StatusChip>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {lease && (
                          <button
                            type="button"
                            onClick={() => setDocumentsFor(lease)}
                            title="Rental agreement"
                            className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-foreground"
                          >
                            <FileTextIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && lease && <LeaseActionsMenu lease={lease} />}
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

      {documentsFor && <LeaseDocumentDialog lease={documentsFor} onClose={() => setDocumentsFor(null)} />}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
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

function LeaseActionsMenu({ lease }: { lease: LeaseWithApartment }) {
  const [mode, setMode] = useState<"edit" | "renew" | "terminate" | null>(null);
  const update = useUpdateLease(lease.id);
  const updateTenant = useUpdateTenant(lease.tenant?.id ?? "");
  const renew = useRenewLease(lease.id);
  const terminate = useTerminateLease(lease.id);
  const upload = useUploadDocument();
  const [editForm, setEditForm] = useState({
    startDate: lease.startDate.slice(0, 10),
    endDate: lease.endDate.slice(0, 10),
    termMonths: lease.termMonths ?? "",
    rentAmountEUR: lease.rentAmountEUR,
    depositAmountEUR: lease.depositAmountEUR,
    rentVatIncluded: lease.rentVatIncluded,
    autoRenewal: lease.autoRenewal,
  });
  const [tenantForm, setTenantForm] = useState({
    firstName: lease.tenant?.firstName ?? "",
    lastName: lease.tenant?.lastName ?? "",
    email: lease.tenant?.email ?? "",
    phone: lease.tenant?.phone ?? "",
  });
  const [renewForm, setRenewForm] = useState({ startDate: "", endDate: "", rentAmountEUR: lease.rentAmountEUR });
  const [renewalFile, setRenewalFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        termMonths: editForm.termMonths === "" ? undefined : Number(editForm.termMonths),
        rentAmountEUR: Number(editForm.rentAmountEUR),
        depositAmountEUR: Number(editForm.depositAmountEUR),
        rentVatIncluded: editForm.rentVatIncluded,
        autoRenewal: editForm.autoRenewal,
      });
      if (
        lease.tenant &&
        (tenantForm.firstName !== lease.tenant.firstName ||
          tenantForm.lastName !== lease.tenant.lastName ||
          tenantForm.email !== lease.tenant.email ||
          tenantForm.phone !== (lease.tenant.phone ?? ""))
      ) {
        await updateTenant.mutateAsync({
          firstName: tenantForm.firstName,
          lastName: tenantForm.lastName,
          email: tenantForm.email,
          phone: tenantForm.phone || undefined,
        });
      }
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              title="More actions"
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-foreground"
            />
          }
        >
          <MoreHorizontalIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMode("edit")}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("renew")}>Renew</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setMode("terminate")}>
            Terminate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode === "edit"} onOpenChange={(v) => setMode(v ? "edit" : null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit lease — {lease.apartment.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            {lease.tenant && (
              <div className="flex flex-col gap-2 border-b border-border pb-3.5">
                <Label>Tenant</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={tenantForm.firstName}
                    onChange={(e) => setTenantForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                  <Input
                    placeholder="Last name"
                    value={tenantForm.lastName}
                    onChange={(e) => setTenantForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={tenantForm.email}
                    onChange={(e) => setTenantForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <Input
                    placeholder="Phone — optional"
                    value={tenantForm.phone}
                    onChange={(e) => setTenantForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Rent (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.rentAmountEUR}
                  onChange={(e) => setEditForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Deposit (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.depositAmountEUR}
                  onChange={(e) => setEditForm((f) => ({ ...f, depositAmountEUR: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Term (months) — optional</Label>
              <Input
                type="number"
                min="1"
                value={editForm.termMonths}
                onChange={(e) => setEditForm((f) => ({ ...f, termMonths: e.target.value }))}
              />
            </div>
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Terminate lease — {lease.apartment.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTerminate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Reason</Label>
              <Textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
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
    </>
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
