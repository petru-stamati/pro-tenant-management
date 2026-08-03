"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useApartmentInvoices, type ApartmentInvoice } from "@/hooks/use-apartment-invoices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TYPE_LABEL, monthLabel } from "@/components/payments-board";
import { formatRON } from "@/lib/format";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function OutstandingDrilldownDialog({ basePath, onClose }: { basePath: "/pm" | "/owner"; onClose: () => void }) {
  const { data: invoices, isLoading } = useApartmentInvoices({ outstandingOnly: true });

  const byApartment = useMemo(() => {
    const map = new Map<string, { name: string; invoices: ApartmentInvoice[] }>();
    for (const inv of invoices?.data ?? []) {
      const entry = map.get(inv.apartmentId) ?? { name: inv.apartment?.name ?? "—", invoices: [] };
      entry.invoices.push(inv);
      map.set(inv.apartmentId, entry);
    }
    return [...map.entries()]
      .map(([apartmentId, entry]) => ({
        apartmentId,
        name: entry.name,
        invoices: entry.invoices.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)),
        total: entry.invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Outstanding balances</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : byApartment.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing outstanding — everything is paid up.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {byApartment.map((a) => (
              <Link
                key={a.apartmentId}
                href={`${basePath}/apartments/${a.apartmentId}`}
                onClick={onClose}
                className="rounded-md border border-border p-3 text-[13px] hover:border-primary"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-medium">{a.name}</span>
                  <span className="font-mono-tabular font-mono font-semibold">{formatRON(a.total)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {a.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-[12px] text-muted-foreground">
                      <span>
                        {TYPE_LABEL[inv.type]} · {monthLabel(inv.periodMonth.slice(0, 7))} · due{" "}
                        {dateFormatter.format(new Date(inv.dueDate))}
                      </span>
                      <span className="font-mono-tabular font-mono">{formatRON(inv.outstandingAmountRON)}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
