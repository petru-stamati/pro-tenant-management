"use client";

import { useAuth } from "@/lib/auth-context";
import { useOwnerSummary } from "@/hooks/use-analytics";
import { useApartments } from "@/hooks/use-apartments";
import { useNotifications } from "@/hooks/use-notifications";
import { KpiCard } from "@/components/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, apartmentStatusTone } from "@/components/status-chip";
import { formatEUR } from "@/lib/format";

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useOwnerSummary(user?.ownerId ?? undefined);
  const { data: apartments } = useApartments({ ownerId: user?.ownerId ?? undefined });
  const { data: notifications } = useNotifications();

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Welcome back, {user?.firstName}</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Your portfolio {summary ? `· ${summary.totalApartments} apartments across Bucharest` : ""}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-[18px] bg-gradient-to-br from-sidebar to-[#0f5c2a] px-7 py-6 text-white">
        <div>
          <p className="text-sm opacity-75">Monthly rental income</p>
          <div className="font-mono-tabular font-mono text-[30px] font-semibold">
            {summaryLoading ? "…" : formatEUR(summary?.monthlyRentalIncomeEUR ?? 0)}
          </div>
          <p className="mt-1.5 text-sm opacity-75">
            {summary ? `${summary.occupancyRate}% occupancy · ${formatEUR(summary.outstandingRentEUR)} outstanding` : ""}
          </p>
        </div>
        {summary?.nextLeaseExpiration && (
          <div className="text-right">
            <p className="text-sm opacity-75">Next lease expiration</p>
            <div className="font-mono text-xl font-semibold">{summary.nextLeaseExpiration.daysRemaining} days</div>
            <p className="text-sm opacity-75">{summary.nextLeaseExpiration.apartmentName}</p>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Apartments"
          value={summaryLoading ? "…" : String(summary?.totalApartments ?? 0)}
          delta={summary ? `${summary.occupiedApartments} occupied · ${summary.vacantApartments} vacant` : undefined}
        />
        <KpiCard
          label="Outstanding Rent"
          value={summaryLoading ? "…" : formatEUR(summary?.outstandingRentEUR ?? 0)}
          deltaTone="down"
        />
        <KpiCard label="Open Maintenance" value={summaryLoading ? "…" : String(summary?.openMaintenanceCount ?? 0)} />
        <KpiCard label="Occupancy Rate" value={summaryLoading ? "…" : `${summary?.occupancyRate ?? 0}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">Your apartments</h3>
          {apartments && apartments.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apartment</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.data.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell>{apt.name}</TableCell>
                    <TableCell className="font-mono-tabular font-mono">
                      {apt.currentLease ? formatEUR(apt.currentLease.rentAmountEUR) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip tone={apartmentStatusTone(apt.status)}>
                        {apt.status === "OCCUPIED" ? "Occupied" : "Vacant"}
                      </StatusChip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No apartments yet.</p>
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
    </div>
  );
}
