"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { useDocuments, downloadDocument } from "@/hooks/use-documents";
import { useDocumentBlobUrl } from "@/hooks/use-document-blob-url";
import { Button } from "@/components/ui/button";
import { formatEUR, dateFormatter } from "@/lib/format";
import type { ApartmentDetail } from "@/hooks/use-apartments";

/**
 * The "brief one-pager" landing view for an apartment — hero photo, tenant,
 * lease basics, contract link, amenities — shown above the tabs so it's the
 * first thing you see, not something you have to click into. The tabs below
 * (Financials, Photos, Inventory, etc.) are for drilling into detail.
 */
export function ApartmentOverview({ apartment }: { apartment: ApartmentDetail }) {
  const { data: docs } = useDocuments({ apartmentId: apartment.id });

  const photos = useMemo(
    () =>
      (docs?.data ?? [])
        .filter((d) => d.category === "PHOTO")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [docs],
  );
  const contract = docs?.data.find((d) => d.category === "CONTRACT");
  const { url: heroUrl } = useDocumentBlobUrl(apartment.coverDocumentId ?? photos[0]?.id);
  const tenant = apartment.currentLease?.tenant;

  async function handleContract() {
    if (!contract) return;
    try {
      await downloadDocument(contract.id, contract.fileName);
    } catch {
      toast.error("Could not open the contract");
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="h-[220px] overflow-hidden rounded-[14px] border border-border bg-muted">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt={apartment.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-muted text-[13px] text-muted-foreground">
            No photos yet
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <InfoItem label="Tenant" value={tenant ? `${tenant.firstName} ${tenant.lastName}` : "Vacant"} />
        <InfoItem label="Rent" value={apartment.currentLease ? formatEUR(apartment.currentLease.rentAmountEUR) : "—"} />
        <InfoItem
          label="Lease ends"
          value={apartment.currentLease ? dateFormatter.format(new Date(apartment.currentLease.endDate)) : "—"}
        />
        <InfoItem label="Surface" value={apartment.surfaceM2 ? `${apartment.surfaceM2} m²` : "—"} />
        <InfoItem label="Rooms" value={apartment.rooms ?? "—"} />
        <InfoItem label="Furnished" value={apartment.furnished ?? "—"} />
        <InfoItem label="Building" value={apartment.building ?? "—"} />
        <InfoItem label="Floor" value={apartment.floor ? `${apartment.floor} of ${apartment.totalFloors ?? "—"}` : "—"} />
        <InfoItem label="Amenities" value={apartment.extras.length ? apartment.extras.join(", ") : "—"} />
      </div>

      {contract && (
        <Button variant="outline" className="self-start" onClick={handleContract}>
          View contract — {contract.fileName}
        </Button>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3">
      <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-[14.5px] font-semibold">{value}</div>
    </div>
  );
}
