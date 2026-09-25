"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenants, useCreateTenant, useTenant, useInviteTenant } from "@/hooks/use-tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";

export default function TenantsPage() {
  const { data: tenants, isLoading } = useTenants();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants?.data ?? [];
    return (tenants?.data ?? []).filter(
      (t) =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.phone ?? "").toLowerCase().includes(q),
    );
  }, [tenants, search]);

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[23px] font-semibold">Tenants</h1>
          <p className="text-[13.5px] text-muted-foreground">{tenants?.data.length ?? 0} tenant profiles</p>
        </div>
        <CreateTenantDialog />
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-[320px]"
        />
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Current lease</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const currentLease = t.leases?.[0];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-[11px] font-semibold text-accent-foreground">
                          {t.firstName[0]}
                          {t.lastName[0]}
                        </div>
                        {t.firstName} {t.lastName}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.email}</TableCell>
                    <TableCell className="font-mono text-[12.5px] text-muted-foreground">{t.phone ?? "—"}</TableCell>
                    <TableCell>
                      {currentLease ? currentLease.apartment.name : <span className="text-muted-foreground italic">No active lease</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <InviteTenantDialog tenantId={t.id} tenantName={`${t.firstName} ${t.lastName}`} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No tenants match this search.</p>
        )}
      </div>
    </div>
  );
}

function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateTenant();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      toast.success("Tenant profile created");
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Add tenant</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              If this email already has a tenant profile, that one is reused instead of duplicating (PRD §3.2).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteTenantDialog({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [open, setOpen] = useState(false);
  const { data: tenant } = useTenant(open ? tenantId : undefined);
  const invite = useInviteTenant(tenantId);
  const [leaseId, setLeaseId] = useState("");
  const [result, setResult] = useState<{ inviteLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite() {
    setError(null);
    try {
      const res = await invite.mutateAsync(leaseId);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setLeaseId("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Invite</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {tenantName}</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              No email provider is configured yet — share this link with the tenant manually. It expires in 7 days.
            </p>
            <Input readOnly value={`${window.location.origin}${result.inviteLink}`} onFocus={(e) => e.target.select()} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Lease</Label>
              <Select value={leaseId} onValueChange={(v) => setLeaseId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lease" />
                </SelectTrigger>
                <SelectContent>
                  {tenant?.leases.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.apartment.name} · {l.owner.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tenant && tenant.leases.length === 0 && (
                <p className="text-xs text-muted-foreground">This tenant has no leases yet — create one first.</p>
              )}
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handleInvite} disabled={!leaseId || invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
