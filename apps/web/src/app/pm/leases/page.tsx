"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useLeases,
  useCreateLease,
  useRenewLease,
  useTerminateLease,
  type LeaseWithApartment,
} from "@/hooks/use-leases";
import { useApartments } from "@/hooks/use-apartments";
import { useTenants } from "@/hooks/use-tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatEUR, dateFormatter } from "@/lib/format";

const STATUS_TONE = { DRAFT: "open", ACTIVE: "paid", ENDED: "progress", TERMINATED: "unpaid" } as const;

export default function LeasesPage() {
  const { data: leases, isLoading } = useLeases();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Leases</h1>
          <p className="text-[13.5px] text-muted-foreground">{leases?.data.length ?? 0} leases</p>
        </div>
        <CreateLeaseDialog />
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : leases && leases.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.apartment.name}</TableCell>
                  <TableCell>{l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(l.rentAmountEUR)}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(l.endDate))}</TableCell>
                  <TableCell>
                    <StatusChip tone={STATUS_TONE[l.status]}>{l.status.toLowerCase()}</StatusChip>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.status === "ACTIVE" && <LeaseActions lease={l} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No leases yet.</p>
        )}
      </div>
    </div>
  );
}

function LeaseActions({ lease }: { lease: LeaseWithApartment }) {
  const [mode, setMode] = useState<"renew" | "terminate" | null>(null);
  const renew = useRenewLease(lease.id);
  const terminate = useTerminateLease(lease.id);
  const [renewForm, setRenewForm] = useState({ startDate: "", endDate: "", rentAmountEUR: lease.rentAmountEUR });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await renew.mutateAsync({
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        rentAmountEUR: Number(renewForm.rentAmountEUR),
      });
      toast.success("Lease renewed");
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
    <div className="flex justify-end gap-2">
      <Dialog open={mode === "renew"} onOpenChange={(v) => setMode(v ? "renew" : null)}>
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
              <Label>Rent (EUR)</Label>
              <Input
                type="number"
                required
                value={renewForm.rentAmountEUR}
                onChange={(e) => setRenewForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
              />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={renew.isPending}>
                {renew.isPending ? "Renewing…" : "Renew lease"}
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

function CreateLeaseDialog() {
  const [open, setOpen] = useState(false);
  const { data: apartments } = useApartments();
  const { data: tenants } = useTenants();
  const create = useCreateLease();
  const [form, setForm] = useState({
    apartmentId: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    rentAmountEUR: "",
    depositAmountEUR: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        ...form,
        rentAmountEUR: Number(form.rentAmountEUR),
        depositAmountEUR: Number(form.depositAmountEUR),
        status: "ACTIVE",
      });
      toast.success("Lease created");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New lease</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lease</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Apartment</Label>
            <Select value={form.apartmentId} onValueChange={(v) => setForm((f) => ({ ...f, apartmentId: v ?? "" }))}>
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
            <Label>Tenant</Label>
            <Select value={form.tenantId} onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v ?? "" }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants?.data.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Start date</Label>
              <Input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>End date</Label>
              <Input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Rent (EUR)</Label>
              <Input
                type="number"
                required
                value={form.rentAmountEUR}
                onChange={(e) => setForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Deposit (EUR)</Label>
              <Input
                type="number"
                required
                value={form.depositAmountEUR}
                onChange={(e) => setForm((f) => ({ ...f, depositAmountEUR: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.apartmentId || !form.tenantId}>
              {create.isPending ? "Creating…" : "Create lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
