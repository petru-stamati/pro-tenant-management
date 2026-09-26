"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useOwnerSummary } from "@/hooks/use-analytics";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useApartmentInvoices } from "@/hooks/use-apartment-invoices";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { useNotifications } from "@/hooks/use-notifications";
import { useLatestExchangeRate } from "@/hooks/use-exchange-rate";
import { NeedsAttentionPanel } from "@/components/needs-attention-panel";
import { OutstandingDrilldownDialog } from "@/components/outstanding-drilldown-dialog";
import { UploadInvoicesDialog } from "@/components/invoice-upload-review";
import { Button } from "@/components/ui/button";
import { Slash } from "@/components/ui/slash";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel } from "@/components/status-chip";
import { formatEUR, formatRON, dateFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const monthLabelFormatter = new Intl.DateTimeFormat("en-GB", { month: "short" });

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useOwnerSummary(user?.ownerId ?? undefined);
  const { data: apartments } = useApartments({ ownerId: user?.ownerId ?? undefined });
  const { data: owners } = useOwners();
  const { data: invoices } = useApartmentInvoices({});
  const { data: pendingRepairs } = useMaintenanceRequests({ status: "PENDING_OWNER_APPROVAL" });
  const { data: notifications } = useNotifications();
  const { data: exchangeRate } = useLatestExchangeRate();
  const [outstandingDrilldown, setOutstandingDrilldown] = useState(false);
  const [uploadInvoices, setUploadInvoices] = useState(false);

  const owner = owners?.data.find((o) => o.id === user?.ownerId);
  const displayName = owner?.contactName?.split(/\s+/)[0] || user?.firstName;

  const balanceByApartment = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices?.data ?? []) {
      if (inv.status === "UNPAID" || inv.status === "PARTIALLY_PAID") {
        map.set(inv.apartmentId, (map.get(inv.apartmentId) ?? 0) + Number(inv.outstandingAmountRON));
      }
    }
    return map;
  }, [invoices]);

  const monthlyIncome = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const inv of invoices?.data ?? []) {
      const key = inv.periodMonth.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(inv.totalAmountRON));
    }
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      months.push({ key, label: monthLabelFormatter.format(d), total: byMonth.get(key) ?? 0 });
    }
    return months;
  }, [invoices]);

  const outstandingThisMonth = useMemo(() => {
    const key = monthKey(new Date());
    return (invoices?.data ?? [])
      .filter((inv) => inv.periodMonth.slice(0, 7) === key && inv.status !== "PAID")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [invoices]);

  const currentMonthTotal = monthlyIncome[monthlyIncome.length - 1]?.total ?? 0;
  const lastYearSameMonth = monthlyIncome[0]?.total; // 12 months back from current, i.e. index 0 in our 12-length window
  const yoyDelta =
    monthlyIncome.length === 12 && lastYearSameMonth ? Math.round(((currentMonthTotal - lastYearSameMonth) / lastYearSameMonth) * 100) : null;
  const maxMonth = Math.max(1, ...monthlyIncome.map((m) => m.total));

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[23px] font-semibold">Welcome back, {displayName}</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Your portfolio {summary ? `· ${summary.totalApartments} apartments across Bucharest` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={() => setUploadInvoices(true)}>
          + Upload invoices
        </Button>
      </div>

      {pendingRepairs && pendingRepairs.data.length > 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-[16px] border border-primary/25 bg-accent px-5 py-4">
          <span className="text-[12.5px] font-semibold text-accent-foreground">Awaiting your decision</span>
          {pendingRepairs.data.map((r) => {
            const cost = r.proposals?.[r.proposals.length - 1]?.costEUR;
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13px]">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted-foreground"> — {r.apartment?.name}</span>
                  {cost && (
                    <span className="ml-2 font-mono-tabular font-mono text-[12.5px]">
                      {formatRON(cost)}
                      {exchangeRate && ` (≈${formatEUR(Number(cost) / Number(exchangeRate.rateRON))})`}
                    </span>
                  )}
                </div>
                <Button size="sm" render={<Link href={`/owner/maintenance/${r.id}`} />}>
                  Review quote →
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="flex items-center gap-2 font-heading text-[16px] font-semibold">
              <Slash />
              Monthly income
            </h3>
            {yoyDelta !== null && (
              <span className={cn("text-[12px] font-medium", yoyDelta >= 0 ? "text-primary" : "text-destructive")}>
                {yoyDelta >= 0 ? "+" : ""}
                {yoyDelta}% YoY
              </span>
            )}
          </div>
          <div className="font-mono-tabular font-mono text-[30px] font-semibold tracking-[-0.8px]">
            {formatRON(currentMonthTotal)}
          </div>
          <div className="mt-4 flex h-[120px] items-end gap-1.5">
            {monthlyIncome.map((m, i) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn("w-full rounded-t-[3px]", i === monthlyIncome.length - 1 ? "bg-primary" : "bg-muted")}
                  style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}px` }}
                />
                <span className="text-[9.5px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-1 flex-col border-t border-divider pt-4">
            <h4 className="mb-2.5 text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
              Outstanding this month
            </h4>
            {outstandingThisMonth.length > 0 ? (
              <div className="flex flex-col divide-y divide-divider overflow-y-auto">
                {outstandingThisMonth.map((inv) => {
                  const overdue = new Date(inv.dueDate).getTime() < Date.now();
                  return (
                    <Link
                      key={inv.id}
                      href={`/owner/apartments/${inv.apartmentId}`}
                      className="flex items-center justify-between gap-3 py-2 text-[12.5px] hover:text-primary"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {inv.apartment?.currentLease?.tenant
                            ? `${inv.apartment.currentLease.tenant.firstName} ${inv.apartment.currentLease.tenant.lastName}`
                            : (inv.apartment?.name ?? "—")}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">{inv.apartment?.name}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono-tabular font-mono font-semibold text-destructive">
                          {formatRON(inv.outstandingAmountRON)}
                        </div>
                        <div className={cn("font-mono text-[10.5px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                          due {dateFormatter.format(new Date(inv.dueDate))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[12.5px] text-muted-foreground">
                Everyone&rsquo;s paid up this month.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 divide-x divide-divider overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-1 px-3 py-3.5">
              <span className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">Occupancy</span>
              <span className="font-mono-tabular font-mono text-[18px] font-semibold">{summaryLoading ? "…" : `${summary?.occupancyRate ?? 0}%`}</span>
            </div>
            <button
              onClick={() => setOutstandingDrilldown(true)}
              className="flex flex-col gap-1 px-3 py-3.5 text-left hover:bg-accent/40"
            >
              <span className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">Outstanding</span>
              <span className="font-mono-tabular font-mono text-[18px] font-semibold text-destructive">
                {summaryLoading ? "…" : formatRON(summary?.outstandingRON ?? 0)}
              </span>
            </button>
            <div className="flex flex-col gap-1 px-3 py-3.5">
              <span className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">Open repairs</span>
              <span className="font-mono-tabular font-mono text-[18px] font-semibold">{summaryLoading ? "…" : (summary?.openMaintenanceCount ?? 0)}</span>
            </div>
          </div>

          {summary?.nextLeaseExpiration && (
            <div className="rounded-[16px] border border-border bg-card p-4 shadow-sm">
              <span className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">Next lease expiration</span>
              <div className="mt-1 font-mono-tabular font-mono text-[20px] font-semibold">
                {summary.nextLeaseExpiration.daysRemaining} days
              </div>
              <p className="text-[12.5px] text-muted-foreground">{summary.nextLeaseExpiration.apartmentName}</p>
            </div>
          )}

          <NeedsAttentionPanel role="OWNER" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Slash />
            Your apartments
          </h3>
          {apartments && apartments.data.length > 0 ? (
            <div className="flex flex-col divide-y divide-divider">
              {apartments.data.map((apt) => {
                const balance = balanceByApartment.get(apt.id) ?? 0;
                return (
                  <Link
                    key={apt.id}
                    href={`/owner/apartments/${apt.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-primary"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{apt.name}</div>
                      <div className="truncate text-[11.5px] text-muted-foreground">
                        {apt.currentLease?.tenant ? `${apt.currentLease.tenant.firstName} ${apt.currentLease.tenant.lastName}` : "Vacant"}
                      </div>
                    </div>
                    <StatusChip tone={apartmentStatusTone(apt.status)}>{apartmentStatusLabel(apt.status)}</StatusChip>
                    <span className="font-mono-tabular font-mono">{apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"}</span>
                    <span className={cn("w-20 text-right font-mono-tabular font-mono", balance > 0 && "text-destructive")}>
                      {formatRON(balance)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No apartments yet.</p>
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
      {outstandingDrilldown && <OutstandingDrilldownDialog basePath="/owner" onClose={() => setOutstandingDrilldown(false)} />}
      {uploadInvoices && <UploadInvoicesDialog onClose={() => setUploadInvoices(false)} />}
    </div>
  );
}
