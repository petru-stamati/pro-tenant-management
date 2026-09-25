"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminSummary, useLeaseExpirations } from "@/hooks/use-analytics";
import { useNotifications } from "@/hooks/use-notifications";
import { NeedsAttentionPanel } from "@/components/needs-attention-panel";
import { RegisterPaymentDialog } from "@/components/payments-board";
import { OutstandingDrilldownDialog } from "@/components/outstanding-drilldown-dialog";
import { NewTaskDialog } from "@/components/tasks-board";
import { ReviewInvoicesDialog } from "@/components/invoice-upload-review";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slash } from "@/components/ui/slash";
import { formatRON } from "@/lib/format";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const eyebrowFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function KpiCell({ label, children, onClick, tint }: { label: string; children: React.ReactNode; onClick?: () => void; tint?: boolean }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-5 py-4 text-left ${tint ? "bg-danger-soft" : ""} ${onClick ? "cursor-pointer transition-colors hover:bg-accent/40" : ""}`}
    >
      <span className="text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{label}</span>
      {children}
    </Comp>
  );
}

export default function PmDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useAdminSummary();
  const { data: expirations, isLoading: expirationsLoading } = useLeaseExpirations(90);
  const { data: notifications } = useNotifications();
  const [registerPayment, setRegisterPayment] = useState(false);
  const [outstandingDrilldown, setOutstandingDrilldown] = useState(false);
  const [reviewInvoices, setReviewInvoices] = useState(false);

  const maxOwnerRevenue = Math.max(1, ...(summary?.revenueByOwner.map((o) => o.monthlyRevenueEUR) ?? [1]));
  const maintenanceApartments = summary
    ? Math.max(0, summary.totalApartments - summary.occupiedApartments - summary.vacantApartments)
    : 0;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-1 font-mono text-[12px] font-medium tracking-[1px] text-muted-foreground uppercase">
        {eyebrowFormatter.format(new Date())} · {summary ? `${summary.totalApartments} apartments` : "…"}
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-[34px] font-semibold tracking-[-0.9px]">
          {greeting()}, {user?.firstName}
        </h1>
        <div className="flex items-center gap-2">
          <NewTaskDialog role="PM" />
          <Button variant="outline" onClick={() => setReviewInvoices(true)}>
            Invoices to assign
          </Button>
          <Button onClick={() => setRegisterPayment(true)}>+ Register payment</Button>
        </div>
      </div>
      {registerPayment && <RegisterPaymentDialog onClose={() => setRegisterPayment(false)} />}
      {outstandingDrilldown && <OutstandingDrilldownDialog basePath="/pm" onClose={() => setOutstandingDrilldown(false)} />}
      {reviewInvoices && <ReviewInvoicesDialog onClose={() => setReviewInvoices(false)} />}

      <div className="mb-6 grid grid-cols-1 divide-y divide-divider overflow-hidden rounded-[16px] border border-border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        <KpiCell label="Monthly revenue">
          <span className="font-mono-tabular font-mono text-[28px] font-semibold tracking-[-0.8px]">
            {summaryLoading ? "…" : `€${(summary?.monthlyRevenueEUR ?? 0).toLocaleString()}`}
          </span>
        </KpiCell>

        <KpiCell label="Occupancy">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-tabular font-mono text-[28px] font-semibold tracking-[-0.8px]">
              {summaryLoading ? "…" : `${summary?.occupancyRate ?? 0}%`}
            </span>
          </div>
          {summary && summary.totalApartments > 0 && (
            <div className="flex flex-wrap gap-[2px]">
              {Array.from({ length: Math.min(summary.totalApartments, 60) }).map((_, i) => (
                <Slash
                  key={i}
                  width={3}
                  height={12}
                  className={i < summary.occupiedApartments ? "bg-primary" : i < summary.occupiedApartments + summary.vacantApartments ? "bg-muted-foreground/30" : "bg-warning"}
                />
              ))}
            </div>
          )}
        </KpiCell>

        <KpiCell label="Outstanding" onClick={() => setOutstandingDrilldown(true)} tint={(summary?.outstandingRON ?? 0) > 0}>
          <span className="font-mono-tabular font-mono text-[28px] font-semibold tracking-[-0.8px] text-destructive">
            {summaryLoading ? "…" : formatRON(summary?.outstandingRON ?? 0)}
          </span>
        </KpiCell>

        <KpiCell label="Paid this month">
          <span className="font-mono-tabular font-mono text-[28px] font-semibold tracking-[-0.8px]">
            {summaryLoading ? "…" : formatRON(summary?.paidRON ?? 0)}
          </span>
          {summary && summary.invoicedRON > 0 && (
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (summary.paidRON / summary.invoicedRON) * 100)}%` }}
              />
            </div>
          )}
        </KpiCell>

        <KpiCell label="Open maintenance">
          <span className="font-mono-tabular font-mono text-[28px] font-semibold tracking-[-0.8px]">
            {summaryLoading ? "…" : (summary?.openMaintenanceCount ?? 0)}
          </span>
          {maintenanceApartments > 0 && (
            <span className="text-[11px] text-warning">{maintenanceApartments} under maintenance</span>
          )}
        </KpiCell>
      </div>

      <div className="mb-6">
        <NeedsAttentionPanel role="PM" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Slash />
            Revenue by owner
          </h3>
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
                      className="h-full rounded-full bg-foreground"
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

        <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Slash />
            Notifications
          </h3>
          {notifications && notifications.data.length > 0 ? (
            <div className="flex flex-col divide-y divide-divider">
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

      <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[16px] font-semibold">
          <Slash />
          Lease expirations — next 90 days
        </h3>
        {expirationsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : expirations && expirations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Days left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expirations.map((lease) => {
                const days = daysUntil(lease.endDate);
                const barColor = days < 30 ? "bg-destructive" : days < 90 ? "bg-warning" : "bg-primary";
                return (
                  <TableRow key={lease.id}>
                    <TableCell>{lease.apartment.name}</TableCell>
                    <TableCell className="text-muted-foreground">{lease.owner.companyName}</TableCell>
                    <TableCell>
                      {lease.tenant.firstName} {lease.tenant.lastName}
                    </TableCell>
                    <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.endDate))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono-tabular font-mono">
                          {days}
                        </Badge>
                        <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${barColor}`} style={{ width: `${Math.max(4, Math.min(100, 100 - days))}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing expiring in the next 90 days.</p>
        )}
      </div>
    </div>
  );
}
