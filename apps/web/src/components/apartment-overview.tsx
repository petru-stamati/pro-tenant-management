"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { useDocuments, downloadDocument } from "@/hooks/use-documents";
import { useDocumentBlobUrl } from "@/hooks/use-document-blob-url";
import { useApartmentInvoices } from "@/hooks/use-apartment-invoices";
import { useLeases } from "@/hooks/use-leases";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { computePaymentStats, paymentReliabilitySummary } from "@/lib/payment-stats";
import { formatEUR, dateFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApartmentDetail } from "@/hooks/use-apartments";
import type { DocumentItem } from "@/hooks/use-documents";

function MosaicTile({ doc, className, onClick }: { doc?: DocumentItem; className?: string; onClick?: () => void }) {
  const { url } = useDocumentBlobUrl(doc?.id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative overflow-hidden rounded-[12px] border border-border bg-muted", className)}
      disabled={!onClick}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-muted text-[11px] text-muted-foreground" />
      )}
    </button>
  );
}

/**
 * The "brief one-pager" landing view for an apartment — photo mosaic,
 * tenant card, contract link — shown above the tabs so it's the first
 * thing you see, not something you have to click into. The tabs below
 * (Financials, Photos, Inventory, etc.) are for drilling into detail.
 */
export function ApartmentOverview({ apartment, onOpenPhotos }: { apartment: ApartmentDetail; onOpenPhotos?: () => void }) {
  const { data: docs } = useDocuments({ apartmentId: apartment.id });
  const { data: invoices } = useApartmentInvoices({ apartmentId: apartment.id });
  const { data: leases } = useLeases({ apartmentId: apartment.id, status: "ACTIVE" });

  const photos = useMemo(
    () =>
      (docs?.data ?? [])
        .filter((d) => d.category === "PHOTO")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [docs],
  );
  const cover = photos.find((p) => p.id === apartment.coverDocumentId) ?? photos[0];
  const rest = photos.filter((p) => p.id !== cover?.id);
  const contract = docs?.data.find((d) => d.category === "CONTRACT");
  const currentLease = leases?.data[0];
  const tenant = apartment.currentLease?.tenant;

  const paymentStats = computePaymentStats(
    (invoices?.data ?? []).filter((inv) => apartment.currentLeaseId && inv.leaseId === apartment.currentLeaseId),
  );
  const paymentSummary = paymentReliabilitySummary(paymentStats);

  async function handleContract() {
    if (!contract) return;
    try {
      await downloadDocument(contract.id, contract.fileName);
    } catch {
      toast.error("Could not open the contract");
    }
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="grid h-[310px] grid-cols-2 gap-2">
        <MosaicTile doc={cover} className="row-span-2 h-full w-full" onClick={onOpenPhotos} />
        <MosaicTile doc={rest[0]} className="h-full w-full" onClick={onOpenPhotos} />
        {rest.length > 1 ? (
          <button
            type="button"
            onClick={onOpenPhotos}
            className="relative h-full w-full overflow-hidden rounded-[12px] bg-sidebar text-white"
          >
            <MosaicTile doc={rest[1]} className="absolute inset-0 h-full w-full opacity-40" />
            <span className="relative flex h-full w-full items-center justify-center font-heading text-[15px] font-semibold">
              +{Math.max(0, photos.length - 2)} photos
            </span>
          </button>
        ) : (
          <MosaicTile doc={rest[1]} className="h-full w-full" onClick={onOpenPhotos} />
        )}
      </div>

      <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-[14px] font-semibold text-white">
            {tenant ? `${tenant.firstName[0]}${tenant.lastName[0]}` : "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-[15px] font-semibold">
              {tenant ? `${tenant.firstName} ${tenant.lastName}` : "Vacant"}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {apartment.currentLease ? `Lease ends ${dateFormatter.format(new Date(apartment.currentLease.endDate))}` : "No active lease"}
            </div>
          </div>
          {tenant && (
            <div className="flex flex-col items-end gap-0.5">
              <StatusChip tone={paymentSummary.tone}>{paymentSummary.text}</StatusChip>
              {paymentStats.onTimeRate !== null && (
                <span className="font-mono text-[10.5px] text-muted-foreground">{paymentStats.onTimeRate}% on-time</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Fact label="Rent" value={apartment.currentLease ? formatEUR(apartment.currentLease.rentAmountEUR) : "—"} mono />
          <Fact label="Surface" value={apartment.surfaceM2 ? `${apartment.surfaceM2} m²` : "—"} mono />
          <Fact label="Rooms" value={apartment.rooms ?? "—"} mono />
          <Fact label="Floor" value={apartment.floor ? `${apartment.floor} of ${apartment.totalFloors ?? "—"}` : "—"} mono />
          <Fact label="Building" value={apartment.building ?? "—"} />
          <Fact label="Furnished" value={apartment.furnished ?? "—"} />
          <Fact
            label="Lease ends"
            value={apartment.currentLease ? dateFormatter.format(new Date(apartment.currentLease.endDate)) : "—"}
            mono
          />
          <Fact label="Deposit" value={currentLease ? formatEUR(currentLease.depositAmountEUR) : "—"} mono />
          <Fact label="Amenities" value={apartment.extras.length ? apartment.extras.join(", ") : "—"} />
        </div>

        {contract && (
          <Button variant="outline" className="mt-4 w-full" onClick={handleContract}>
            View contract — {contract.fileName}
          </Button>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border bg-background/60 px-2.5 py-2">
      <div className="mb-0.5 text-[9.5px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("truncate text-[12.5px] font-semibold", mono && "font-mono-tabular font-mono")}>{value}</div>
    </div>
  );
}
