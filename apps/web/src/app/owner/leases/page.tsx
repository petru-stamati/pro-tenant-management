"use client";

import { useLeases } from "@/hooks/use-leases";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/status-chip";
import { formatEUR, dateFormatter } from "@/lib/format";

const STATUS_TONE = { DRAFT: "open", ACTIVE: "paid", ENDED: "progress", TERMINATED: "unpaid" } as const;

export default function OwnerLeasesPage() {
  const { data: leases, isLoading } = useLeases();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Leases</h1>
        <p className="text-[13.5px] text-muted-foreground">{leases?.data.length ?? 0} leases</p>
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : leases && leases.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.apartment.name}</TableCell>
                  <TableCell>{l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(l.rentAmountEUR)}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(l.endDate))}</TableCell>
                  <TableCell>
                    <StatusChip tone={STATUS_TONE[l.status]}>{l.status.toLowerCase()}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No leases yet.</p>
        )}
      </div>
    </div>
  );
}
