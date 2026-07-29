"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useMyLeases } from "@/hooks/use-leases";
import { useMyInvoices } from "@/hooks/use-invoices";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { formatEUR, formatRON, dateFormatter } from "@/lib/format";

export default function TenantDashboardPage() {
  const { user } = useAuth();
  const { data: leases, isLoading: leasesLoading } = useMyLeases();
  const { data: invoices } = useMyInvoices();

  const activeLeases = leases?.data.filter((l) => l.status === "ACTIVE") ?? [];
  const otherLeases = leases?.data.filter((l) => l.status !== "ACTIVE") ?? [];

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-[23px] font-semibold">Welcome, {user?.firstName}</h1>
        <p className="text-[13.5px] text-muted-foreground">Your apartment, lease, and invoices.</p>
      </div>

      {leasesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activeLeases.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No active lease on file yet.
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          {activeLeases.map((lease) => (
            <div key={lease.id} className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">{lease.apartment.name}</h3>
                  <p className="text-[12.5px] text-muted-foreground">
                    {lease.apartment.addressLine}, {lease.apartment.city}
                  </p>
                </div>
                <Button
                  size="sm"
                  render={<Link href={`/tenant/maintenance?apartmentId=${lease.apartment.id}`}>Report an issue</Link>}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoItem label="Rent" value={formatEUR(lease.rentAmountEUR)} />
                <InfoItem label="Deposit" value={formatEUR(lease.depositAmountEUR)} />
                <InfoItem
                  label="Deposit status"
                  value={
                    <StatusChip tone={lease.depositStatus === "HELD" ? "open" : "paid"}>
                      {lease.depositStatus.replace("_", " ").toLowerCase()}
                    </StatusChip>
                  }
                />
                <InfoItem label="Lease ends" value={dateFormatter.format(new Date(lease.endDate))} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3.5 text-[14.5px] font-semibold">Recent invoices</h3>
        {invoices && invoices.data.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {invoices.data.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <div>
                  <div>{inv.lease.apartment.name}</div>
                  <div className="text-xs text-muted-foreground">{dateFormatter.format(new Date(inv.invoiceDate))}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono-tabular font-mono">{formatRON(inv.amountRON)}</div>
                  <StatusChip tone={inv.status === "PAID" ? "paid" : inv.status === "OVERDUE" ? "unpaid" : "open"}>
                    {inv.status.toLowerCase()}
                  </StatusChip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        )}
      </div>

      {otherLeases.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {otherLeases.length} past lease{otherLeases.length > 1 ? "s" : ""} on file.
        </p>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-background/60 px-3.5 py-2.5">
      <div className="mb-1 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-[13.5px] font-medium">{value}</div>
    </div>
  );
}
