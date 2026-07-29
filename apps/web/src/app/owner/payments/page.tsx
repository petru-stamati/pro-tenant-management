"use client";

import { useRentPayments } from "@/hooks/use-rent-payments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { formatEUR, dateFormatter } from "@/lib/format";

export default function OwnerPaymentsPage() {
  const { data: payments, isLoading } = useRentPayments();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Rent Payments</h1>
        <p className="text-[13.5px] text-muted-foreground">{payments?.data.length ?? 0} ledger entries</p>
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : payments && payments.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.apartment?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(p.dueDate))}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(p.rentAmountEUR)}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(p.paidAmountEUR)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(p.status)}>{p.status.replace("_", " ").toLowerCase()}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No rent payments yet.</p>
        )}
      </div>
    </div>
  );
}
