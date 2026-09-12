"use client";

import Link from "next/link";
import { useApartments } from "@/hooks/use-apartments";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { ApartmentThumbnail } from "@/components/apartment-thumbnail";
import { formatEUR } from "@/lib/format";

export default function OwnerApartmentsPage() {
  const { data: apartments, isLoading } = useApartments();

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Your apartments</h1>
        <p className="text-[13.5px] text-muted-foreground">{apartments?.data.length ?? 0} units</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apartments && apartments.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apartments.data.map((apt) => (
            <Link
              key={apt.id}
              href={`/owner/apartments/${apt.id}`}
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
                  {apt.sector ? `, ${apt.sector}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No apartments yet.
        </div>
      )}
    </div>
  );
}
