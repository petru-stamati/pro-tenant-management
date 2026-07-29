"use client";

import { useApartments } from "@/hooks/use-apartments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, apartmentStatusTone } from "@/components/status-chip";
import { formatEUR } from "@/lib/format";

export default function OwnerApartmentsPage() {
  const { data: apartments, isLoading } = useApartments();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Your apartments</h1>
        <p className="text-[13.5px] text-muted-foreground">{apartments?.data.length ?? 0} units</p>
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : apartments && apartments.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apartments.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.city}
                    {a.sector ? `, ${a.sector}` : ""}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">
                    {a.currentLease ? formatEUR(a.currentLease.rentAmountEUR) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusChip tone={apartmentStatusTone(a.status)}>
                      {a.status === "OCCUPIED" ? "Occupied" : "Vacant"}
                    </StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No apartments yet.</p>
        )}
      </div>
    </div>
  );
}
