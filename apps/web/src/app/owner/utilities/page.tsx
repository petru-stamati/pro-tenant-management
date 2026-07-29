"use client";

import { useUtilityRecords } from "@/hooks/use-utility-records";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { formatRON } from "@/lib/format";

export default function OwnerUtilitiesPage() {
  const { data: records, isLoading } = useUtilityRecords();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Utilities</h1>
        <p className="text-[13.5px] text-muted-foreground">{records?.data.length ?? 0} records</p>
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : records && records.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Consumption</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.apartment?.name ?? "—"}</TableCell>
                  <TableCell>{r.utilityType.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.consumption ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatRON(r.invoiceAmountRON)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(r.invoiceStatus)}>{r.invoiceStatus.toLowerCase()}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No utility records yet.</p>
        )}
      </div>
    </div>
  );
}
