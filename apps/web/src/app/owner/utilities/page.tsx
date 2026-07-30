"use client";

import { useState } from "react";
import { useUtilityRecords, type UtilityRecord } from "@/hooks/use-utility-records";
import { MeterPicturesDialog } from "@/components/meter-pictures-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { formatRON, dateFormatter } from "@/lib/format";

const UTILITY_UNIT: Record<string, string> = {
  ELECTRICITY: "kWh",
  GAS: "m³",
  COLD_WATER: "m³",
  HOT_WATER: "m³",
  HEATING: "units",
};

export default function OwnerUtilitiesPage() {
  const { data: records, isLoading } = useUtilityRecords();
  const [picturesFor, setPicturesFor] = useState<UtilityRecord | null>(null);

  return (
    <div className="mx-auto max-w-[1100px]">
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
                <TableHead>Period</TableHead>
                <TableHead>Last month</TableHead>
                <TableHead>This month</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.apartment?.name ?? "—"}</TableCell>
                  <TableCell>{r.utilityType.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">
                    {dateFormatter.format(new Date(r.periodMonth))}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.previousReading ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.currentReading ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">
                    {r.consumption ?? "—"} {r.consumption ? UTILITY_UNIT[r.utilityType] : ""}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatRON(r.invoiceAmountRON)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(r.invoiceStatus)}>{r.invoiceStatus.toLowerCase()}</StatusChip>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setPicturesFor(r)}>
                      See pictures
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No utility records yet.</p>
        )}
      </div>

      {picturesFor && <MeterPicturesDialog record={picturesFor} onClose={() => setPicturesFor(null)} />}
    </div>
  );
}
