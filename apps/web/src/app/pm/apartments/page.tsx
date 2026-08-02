"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { Button } from "@/components/ui/button";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { ApartmentFormDialog } from "@/components/apartment-form-dialog";
import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE";

export default function ApartmentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const { data: apartments, isLoading } = useApartments({
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });
  const { data: owners } = useOwners();

  const ownerNameById = useMemo(() => new Map(owners?.data.map((o) => [o.id, o.companyName]) ?? []), [owners]);

  const counts = useMemo(() => {
    const data = apartments?.data ?? [];
    return {
      all: data.length,
      vacant: data.filter((a) => a.status === "VACANT").length,
      occupied: data.filter((a) => a.status === "OCCUPIED").length,
      underMaintenance: data.filter((a) => a.status === "UNDER_MAINTENANCE").length,
    };
  }, [apartments]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Apartments</h1>
          <p className="text-[13.5px] text-muted-foreground">{counts.all} units</p>
        </div>
        <ApartmentFormDialog trigger={<Button>+ Add apartment</Button>} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apartments && apartments.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apartments.data.map((apt) => (
            <Link
              key={apt.id}
              href={`/pm/apartments/${apt.id}`}
              className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative h-[110px] bg-gradient-to-br from-accent to-muted">
                <span className="absolute top-2.5 right-2.5">
                  <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                </span>
              </div>
              <div className="p-4">
                <h4 className="mb-0.5 text-[15px] font-semibold">{apt.name}</h4>
                <div className="mb-3 text-xs text-muted-foreground">
                  {apt.city}
                  {apt.sector ? `, ${apt.sector}` : ""} · {ownerNameById.get(apt.ownerId) ?? "—"}
                </div>
                <Row k="Rent" v={apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"} />
                <Row
                  k={apt.status === "OCCUPIED" ? "Lease ends" : "Status"}
                  v={
                    apt.currentLease
                      ? new Date(apt.currentLease.endDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : apartmentStatusLabel(apt.status)
                  }
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No apartments match this filter.
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-border py-1.5 text-[12.5px] first:border-t-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono-tabular font-mono font-semibold">{v}</span>
    </div>
  );
}
