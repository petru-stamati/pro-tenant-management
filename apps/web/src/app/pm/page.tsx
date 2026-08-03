"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminSummary, useLeaseExpirations } from "@/hooks/use-analytics";
import { useNotifications } from "@/hooks/use-notifications";
import { KpiCard } from "@/components/kpi-card";
import { NeedsAttentionPanel } from "@/components/needs-attention-panel";
import { RegisterPaymentDialog } from "@/components/payments-board";
import { OutstandingDrilldownDialog } from "@/components/outstanding-drilldown-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRON } from "@/lib/format";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function PmDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useAdminSummary();
  const { data: expirations, isLoading: expirationsLoading } = useLeaseExpirations(90);
  const { data: notifications } = useNotifications();
  const [registerPayment, setRegisterPayment] = useState(false);
  const [outstandingDrilldown, setOutstandingDrilldown] = useState(false);

  const maxOwnerRevenue = Math.max(1, ...(summary?.revenueByOwner.map((o) => o.monthlyRevenueEUR) ?? [1]));

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Good morning, {user?.firstName}</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {summary ? `${summary.totalApartments} apartments` : "…"} ·{" "}
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </p>
        </div>
        <Button onClick={() => setRegisterPayment(true)}>+ Register payment</Button>
      </div>
      {registerPayment && <RegisterPaymentDialog onClose={() => setRegisterPayment(false)} />}
      {outstandingDrilldown && <OutstandingDrilldownDialog basePath="/pm" onClose={() => setOutstandingDrilldown(false)} />}

      <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Monthly Revenue"
          value={summaryLoading ? "…" : `€${(summary?.monthlyRevenueEUR ?? 0).toLocaleString()}`}
        />
        <KpiCard
          label="Occupancy Rate"
          value={summaryLoading ? "…" : `${summary?.occupancyRate ?? 0}%`}
          delta={summary ? `${summary.occupiedApartments} of ${summary.totalApartments} occupied` : undefined}
        />
        <KpiCard
          label="Outstanding"
          value={summaryLoading ? "…" : formatRON(summary?.outstandingRON ?? 0)}
          deltaTone="down"
          delta={summary && summary.outstandingRON > 0 ? "Needs follow-up" : undefined}
          onClick={() => setOutstandingDrilldown(true)}
        />
        <KpiCard label="Paid this month" value={summaryLoading ? "…" : formatRON(summary?.paidRON ?? 0)} />
        <KpiCard
          label="Open Maintenance"
          value={summaryLoading ? "…" : String(summary?.openMaintenanceCount ?? 0)}
        />
      </div>

      <div className="mb-6">
        <NeedsAttentionPanel role="PM" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">Revenue by owner (EUR / month)</h3>
          {summary?.revenueByOwner.length ? (
            <div className="flex flex-col gap-4">
              {summary.revenueByOwner.map((o) => (
                <div key={o.ownerId}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span>{o.ownerName}</span>
                    <span className="font-mono-tabular font-mono">€{o.monthlyRevenueEUR.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(o.monthlyRevenueEUR / maxOwnerRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active leases yet.</p>
          )}
        </div>

        <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">Notifications</h3>
          {notifications && notifications.data.length > 0 ? (
            <div className="flex flex-col divide-y divide-border">
              {notifications.data.map((n) => (
                <div key={n.id} className="py-2.5 text-[13px]">
                  {n.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing new.</p>
          )}
        </div>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3.5 text-[14.5px] font-semibold">Lease expirations — next 90 days</h3>
        {expirationsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : expirations && expirations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Lease End</TableHead>
                <TableHead>Days Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expirations.map((lease) => (
                <TableRow key={lease.id}>
                  <TableCell>{lease.apartment.name}</TableCell>
                  <TableCell className="text-muted-foreground">{lease.owner.companyName}</TableCell>
                  <TableCell>
                    {lease.tenant.firstName} {lease.tenant.lastName}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.endDate))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono-tabular font-mono">
                      {daysUntil(lease.endDate)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing expiring in the next 90 days.</p>
        )}
      </div>
    </div>
  );
}
