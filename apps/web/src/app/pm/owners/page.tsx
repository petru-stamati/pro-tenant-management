"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOwners, useCreateOwner } from "@/hooks/use-owners";
import { useApartments } from "@/hooks/use-apartments";
import { useScope } from "@/lib/scope-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { formatEUR } from "@/lib/format";

export default function OwnersPage() {
  const { data: owners, isLoading } = useOwners();
  const { data: apartments } = useApartments();
  const scope = useScope();
  const router = useRouter();

  const statsByOwner = useMemo(() => {
    const map = new Map<string, { units: number; occupied: number; rentEUR: number }>();
    for (const a of apartments?.data ?? []) {
      const s = map.get(a.ownerId) ?? { units: 0, occupied: 0, rentEUR: 0 };
      s.units += 1;
      if (a.status === "OCCUPIED") s.occupied += 1;
      if (a.currentLease) s.rentEUR += Number(a.currentLease.rentAmountEUR);
      map.set(a.ownerId, s);
    }
    return map;
  }, [apartments]);

  function selectOwner(ownerId: string) {
    scope?.setOwnerId(ownerId);
    router.push("/pm/apartments");
    toast.success("Filtered to this owner");
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[23px] font-semibold">Owners</h1>
          <p className="text-[13.5px] text-muted-foreground">{owners?.data.length ?? 0} owner companies</p>
        </div>
        <CreateOwnerDialog />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : owners && owners.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {owners.data.map((o) => {
            const stats = statsByOwner.get(o.id) ?? { units: 0, occupied: 0, rentEUR: 0 };
            return (
              <button
                key={o.id}
                onClick={() => selectOwner(o.id)}
                className="rounded-[16px] border border-border bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-[0_8px_24px_rgba(20,23,15,.08)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-sidebar font-heading text-[14px] font-semibold text-white">
                    {o.companyName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-heading text-[14.5px] font-semibold">{o.companyName}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{o.contactName}</div>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-3 divide-x divide-divider overflow-hidden rounded-[10px] border border-border">
                  <div className="flex flex-col items-center gap-0.5 px-1 py-2">
                    <span className="font-mono-tabular font-mono text-[15px] font-semibold">{stats.units}</span>
                    <span className="text-[9.5px] text-muted-foreground uppercase">Units</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-1 py-2">
                    <span className="font-mono-tabular font-mono text-[15px] font-semibold">{stats.occupied}</span>
                    <span className="text-[9.5px] text-muted-foreground uppercase">Occupied</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-1 py-2">
                    <span className="font-mono-tabular font-mono text-[15px] font-semibold">{formatEUR(stats.rentEUR)}</span>
                    <span className="text-[9.5px] text-muted-foreground uppercase">Rent/mo</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 text-[12.5px] text-muted-foreground">
                  <span className="truncate">{o.email}</span>
                  <span>{o.phone ?? "—"}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No owners yet.
        </div>
      )}
    </div>
  );
}

function CreateOwnerDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateOwner();
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      toast.success("Owner created");
      setForm({ companyName: "", contactName: "", email: "", phone: "" });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Add owner</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add owner</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              required
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactName">Contact name</Label>
            <Input
              id="contactName"
              required
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            />
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create owner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
