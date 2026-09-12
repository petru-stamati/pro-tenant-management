"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useApartment, useTenantHistory } from "@/hooks/use-apartments";
import { useLeases } from "@/hooks/use-leases";
import { useDocuments, downloadDocument } from "@/hooks/use-documents";
import { ApartmentFinancialsTab } from "@/components/apartment-financials-tab";
import { ApartmentInventory } from "@/components/apartment-inventory";
import { ApartmentPhotosTab } from "@/components/apartment-photos-tab";
import { ApartmentOverview } from "@/components/apartment-overview";
import { ApartmentActivityTab } from "@/components/apartment-activity-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { formatEUR, dateFormatter } from "@/lib/format";

export default function OwnerApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: apartment, isLoading } = useApartment(id);

  if (isLoading || !apartment) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5">
        <h1 className="mb-1 text-[22px] font-semibold">{apartment.name}</h1>
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {apartment.addressLine}, {apartment.city}
          {apartment.sector ? `, ${apartment.sector}` : ""}
          <StatusChip tone={apartmentStatusTone(apartment.status)}>{apartmentStatusLabel(apartment.status)}</StatusChip>
        </p>
      </div>

      <ApartmentOverview apartment={apartment} />

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="lease">Current Lease</TabsTrigger>
          <TabsTrigger value="history">Previous Tenants</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-5">
          <ApartmentActivityTab apartmentId={id} role="OWNER" />
        </TabsContent>

        <TabsContent value="inventory" className="mt-5">
          <ApartmentInventory apartmentId={id} canEdit={false} />
        </TabsContent>

        <TabsContent value="financials" className="mt-5">
          <ApartmentFinancialsTab apartmentId={id} canEdit={false} />
        </TabsContent>

        <TabsContent value="photos" className="mt-5">
          <ApartmentPhotosTab apartmentId={id} canEdit={false} />
        </TabsContent>

        <TabsContent value="lease" className="mt-5">
          <CurrentLeaseTab apartmentId={id} currentLeaseId={apartment.currentLeaseId} />
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <TenantHistoryTab apartmentId={id} />
        </TabsContent>
      </Tabs>
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

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">{children}</div>;
}

function CurrentLeaseTab({ apartmentId, currentLeaseId }: { apartmentId: string; currentLeaseId: string | null }) {
  const { data: leases, isLoading } = useLeases({ apartmentId });
  const { data: contracts } = useDocuments({ apartmentId });
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const currentLease = leases?.data.find((l) => l.id === currentLeaseId);

  if (!currentLease) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">No active lease on this apartment right now.</p>
      </Panel>
    );
  }

  const contract = contracts?.data.find((d) => d.category === "CONTRACT");

  async function handleViewContract() {
    if (!contract) return;
    setDownloading(true);
    try {
      await downloadDocument(contract.id, contract.fileName);
    } catch {
      toast.error("Could not open the contract");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <InfoItem label="Tenant" value={currentLease.tenant ? `${currentLease.tenant.firstName} ${currentLease.tenant.lastName}` : "—"} />
        <InfoItem label="Rent" value={formatEUR(currentLease.rentAmountEUR)} />
        <InfoItem label="Deposit" value={`${formatEUR(currentLease.depositAmountEUR)} (${currentLease.depositStatus.toLowerCase()})`} />
        <InfoItem label="Start date" value={dateFormatter.format(new Date(currentLease.startDate))} />
        <InfoItem label="End date" value={dateFormatter.format(new Date(currentLease.endDate))} />
        <InfoItem label="Status" value={currentLease.status} />
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={handleViewContract} disabled={!contract || downloading}>
          {contract ? (downloading ? "Opening…" : "See contract") : "No contract uploaded yet"}
        </Button>
      </div>
    </Panel>
  );
}

function TenantHistoryTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useTenantHistory(apartmentId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">No leases on record yet.</p>
      </Panel>
    );
  }
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Rent</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((lease) => (
            <TableRow key={lease.id}>
              <TableCell>
                {lease.tenant.firstName} {lease.tenant.lastName}
              </TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatEUR(lease.rentAmountEUR)}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.startDate))}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.endDate))}</TableCell>
              <TableCell>{lease.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
