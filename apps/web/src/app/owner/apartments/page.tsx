"use client";

import Link from "next/link";
import { useApartments } from "@/hooks/use-apartments";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
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
              <div className="relative h-[110px] bg-gradient-to-br from-accent to-muted">
                <span className="absolute top-2.5 right-2.5">
                  <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                </span>
              </div>
              <div className="p-4">
                <h4 className="mb-0.5 text-[15px] font-semibold">{apt.name}</h4>
                <div className="mb-3 text-xs text-muted-foreground">
                  {apt.city}
                  {apt.sector ? `, ${apt.sector}` : ""}
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
          No apartments yet.
        </div>
      )}
    </div>
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
