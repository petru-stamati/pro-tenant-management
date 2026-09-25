"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useApartmentInvoices } from "@/hooks/use-apartment-invoices";
import { useScope } from "@/lib/scope-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { ApartmentFormDialog } from "@/components/apartment-form-dialog";
import { ApartmentThumbnail } from "@/components/apartment-thumbnail";
import { formatEUR, formatRON } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE";
type ViewMode = "grid" | "list";

export default function ApartmentsPage() {
  const scope = useScope();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>(scope?.ownerId ?? "ALL");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const { data: apartments, isLoading } = useApartments({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    ownerId: ownerFilter === "ALL" ? undefined : ownerFilter,
  });
  const { data: owners } = useOwners();
  const { data: outstandingInvoices } = useApartmentInvoices({ outstandingOnly: true });

  const ownerNameById = useMemo(() => new Map(owners?.data.map((o) => [o.id, o.companyName]) ?? []), [owners]);
  const balanceByApartment = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of outstandingInvoices?.data ?? []) {
      map.set(inv.apartmentId, (map.get(inv.apartmentId) ?? 0) + Number(inv.outstandingAmountRON));
    }
    return map;
  }, [outstandingInvoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (apartments?.data ?? []).filter((a) => !q || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q));
  }, [apartments, search]);

  const counts = useMemo(() => {
    const data = apartments?.data ?? [];
    return {
      all: data.length,
      vacant: data.filter((a) => a.status === "VACANT").length,
      occupied: data.filter((a) => a.status === "OCCUPIED").length,
      underMaintenance: data.filter((a) => a.status === "UNDER_MAINTENANCE").length,
    };
  }, [apartments]);

  const monthlyRentTotal = (apartments?.data ?? []).reduce(
    (sum, a) => sum + (a.currentLease ? Number(a.currentLease.rentAmountEUR) : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-1 font-mono text-[12px] font-medium tracking-[1px] text-muted-foreground uppercase">
        {counts.all} units · {owners?.meta.total ?? "…"} owners · €{monthlyRentTotal.toLocaleString()} / mo
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-[23px] font-semibold">Apartments</h1>
        <ApartmentFormDialog trigger={<Button>+ Add apartment</Button>} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterButton active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>
          All ({counts.all})
        </FilterButton>
        <FilterButton active={statusFilter === "OCCUPIED"} onClick={() => setStatusFilter("OCCUPIED")}>
          Occupied ({counts.occupied})
        </FilterButton>
        <FilterButton active={statusFilter === "VACANT"} onClick={() => setStatusFilter("VACANT")}>
          Vacant ({counts.vacant})
        </FilterButton>
        <FilterButton active={statusFilter === "UNDER_MAINTENANCE"} onClick={() => setStatusFilter("UNDER_MAINTENANCE")}>
          Under maintenance ({counts.underMaintenance})
        </FilterButton>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filter by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[200px]"
          />
          <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v ?? "ALL")}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All owners</SelectItem>
              {owners?.data.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn("rounded-md p-1.5", view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn("rounded-md p-1.5", view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No apartments match this filter.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((apt) => {
            const balance = balanceByApartment.get(apt.id) ?? 0;
            return (
              <Link
                key={apt.id}
                href={`/pm/apartments/${apt.id}`}
                className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm transition-shadow hover:shadow-[0_8px_24px_rgba(20,23,15,.08)]"
              >
                <div className="relative h-[168px] overflow-hidden">
                  <ApartmentThumbnail apartmentId={apt.id} coverDocumentId={apt.coverDocumentId} />
                  <span className="absolute top-2.5 right-2.5">
                    <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                  </span>
                </div>
                <div className="px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="truncate font-heading text-[14.5px] font-semibold">{apt.name}</h4>
                    <span className="shrink-0 font-mono-tabular font-mono text-[12.5px] font-semibold">
                      {apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {apt.sector ?? apt.city} · {ownerNameById.get(apt.ownerId) ?? "—"}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-divider pt-2 text-[11px]">
                    <span className="truncate text-muted-foreground">
                      {apt.currentLease?.tenant ? `${apt.currentLease.tenant.firstName} ${apt.currentLease.tenant.lastName}` : "Vacant"}
                    </span>
                    <span className={cn("font-mono-tabular font-mono", balance > 0 ? "text-destructive" : "text-muted-foreground")}>
                      {formatRON(balance)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Apartment</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Owner</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Tenant</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Rent</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Balance</th>
                <th className="p-3 text-[10.5px] font-semibold tracking-[1px] text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((apt) => {
                const balance = balanceByApartment.get(apt.id) ?? 0;
                return (
                  <tr key={apt.id} className="border-b border-divider last:border-0 hover:bg-accent/30">
                    <td className="p-3">
                      <Link href={`/pm/apartments/${apt.id}`} className="font-medium hover:underline">
                        {apt.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{apt.city}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{ownerNameById.get(apt.ownerId) ?? "—"}</td>
                    <td className="p-3">
                      {apt.currentLease?.tenant ? `${apt.currentLease.tenant.firstName} ${apt.currentLease.tenant.lastName}` : "—"}
                    </td>
                    <td className="p-3 font-mono-tabular font-mono">
                      {apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"}
                    </td>
                    <td className={cn("p-3 font-mono-tabular font-mono", balance > 0 && "text-destructive")}>{formatRON(balance)}</td>
                    <td className="p-3">
                      <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
