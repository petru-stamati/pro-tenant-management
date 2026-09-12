"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { Button } from "@/components/ui/button";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { ApartmentFormDialog } from "@/components/apartment-form-dialog";
import { ApartmentThumbnail } from "@/components/apartment-thumbnail";
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
              <div className="relative h-[210px] overflow-hidden">
                <ApartmentThumbnail apartmentId={apt.id} coverDocumentId={apt.coverDocumentId} />
                <span className="absolute top-2.5 right-2.5">
                  <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                </span>
              </div>
              <div className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="truncate text-[13.5px] font-semibold">{apt.name}</h4>
                  <span className="shrink-0 font-mono-tabular font-mono text-[12.5px] font-semibold">
                    {apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {apt.city}
                  {apt.sector ? `, ${apt.sector}` : ""} · {ownerNameById.get(apt.ownerId) ?? "—"}
                </div>
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

