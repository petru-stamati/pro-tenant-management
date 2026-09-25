"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useMyLeases } from "@/hooks/use-leases";
import { useMyInvoices } from "@/hooks/use-invoices";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { Slash } from "@/components/ui/slash";
import { formatEUR, formatRON, dateFormatter } from "@/lib/format";

const REQUEST_STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Being reviewed",
  PROPOSAL_CREATED: "Being reviewed",
  PENDING_OWNER_APPROVAL: "Being reviewed",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repair complete",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const REQUEST_STATUS_TONE: Record<string, "open" | "progress" | "done" | "unpaid"> = {
  REPORTED: "open",
  TRIAGED: "progress",
  PROPOSAL_CREATED: "progress",
  PENDING_OWNER_APPROVAL: "progress",
  IN_PROGRESS: "progress",
  REPAIRED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function LeaseTermStrip({ startDate, endDate, termMonths }: { startDate: string; endDate: string; termMonths: number | null }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const total = termMonths ?? Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 86_400_000)));
  const elapsed = Math.min(total, Math.max(0, Math.round((Date.now() - start.getTime()) / (30.44 * 86_400_000))));
  return (
    <div>
      <div className="flex flex-wrap gap-[3px]">
        {Array.from({ length: total }).map((_, i) => (
          <Slash key={i} width={5} height={14} className={i < elapsed ? "bg-primary" : "bg-muted"} />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span className="font-mono">{dateFormatter.format(start)}</span>
        <span>
          {elapsed} of {total} months
        </span>
        <span className="font-mono">{dateFormatter.format(end)}</span>
      </div>
    </div>
  );
}

export default function TenantDashboardPage() {
  const { user } = useAuth();
  const { data: leases, isLoading: leasesLoading } = useMyLeases();
  const { data: invoices } = useMyInvoices();
  const { data: requests } = useMaintenanceRequests();

  const activeLeases = leases?.data.filter((l) => l.status === "ACTIVE") ?? [];
  const otherLeases = leases?.data.filter((l) => l.status !== "ACTIVE") ?? [];

  const outstandingInvoices = (invoices?.data ?? []).filter((i) => i.status === "ISSUED" || i.status === "OVERDUE");
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.amountRON), 0);
  const nextDue = [...outstandingInvoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const openRequests = (requests?.data ?? []).filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED");

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <h1 className="font-heading text-[23px] font-semibold">Welcome, {user?.firstName}</h1>
        <p className="text-[13.5px] text-muted-foreground">Your apartment, lease, and invoices.</p>
      </div>

      {outstandingTotal > 0 && (
        <div className="relative mb-6 overflow-hidden rounded-[18px] bg-sidebar px-6 py-6 text-white">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-[10px] bottom-[-40px] bg-primary opacity-20"
            style={{ width: 40, height: 200, transform: "skewX(-16deg)" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-[46px] bottom-[-40px] bg-white opacity-[.06]"
            style={{ width: 40, height: 200, transform: "skewX(-16deg)" }}
          />
          <div className="relative">
            <p className="text-[12.5px] text-white/70">Outstanding balance</p>
            <div className="font-mono-tabular font-mono text-[42px] font-semibold tracking-[-1px]">{formatRON(outstandingTotal)}</div>
            {nextDue && (
              <p className="mt-1 text-[13px] text-white/75">
                {nextDue.lease.apartment.name} · due {dateFormatter.format(new Date(nextDue.dueDate))} ·{" "}
                {daysUntil(nextDue.dueDate) >= 0 ? `${daysUntil(nextDue.dueDate)} days left` : `${-daysUntil(nextDue.dueDate)} days overdue`}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" render={<Link href="/tenant/invoices" />}>
                Payment details
              </Button>
              <Button size="sm" variant="secondary" render={<Link href="/tenant/invoices" />}>
                View invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {leasesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activeLeases.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No active lease on file yet.
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          {activeLeases.map((lease) => (
            <div key={lease.id} className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-heading text-[15px] font-semibold">{lease.apartment.name}</h3>
                    <StatusChip tone="done">Active</StatusChip>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">
                    {lease.apartment.addressLine}, {lease.apartment.city}
                  </p>
                </div>
                <Button size="sm" render={<Link href={`/tenant/maintenance?apartmentId=${lease.apartment.id}`} />}>
                  Report an issue
                </Button>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <InfoItem label="Rent" value={formatEUR(lease.rentAmountEUR)} />
                <InfoItem
                  label="Deposit"
                  value={
                    <>
                      {formatEUR(lease.depositAmountEUR)}{" "}
                      <StatusChip tone={lease.depositStatus === "HELD" ? "open" : "paid"}>
                        {lease.depositStatus.replace("_", " ").toLowerCase()}
                      </StatusChip>
                    </>
                  }
                />
                <InfoItem label="Lease ends" value={dateFormatter.format(new Date(lease.endDate))} />
              </div>
              <LeaseTermStrip startDate={lease.startDate} endDate={lease.endDate} termMonths={lease.termMonths} />
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[14.5px] font-semibold">
            <Slash />
            Invoices & payments
          </h3>
          {invoices && invoices.data.length > 0 ? (
            <div className="flex flex-col divide-y divide-divider">
              {invoices.data.slice(0, 6).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2.5 text-[13px]">
                  <div>
                    <div>{inv.lease.apartment.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{dateFormatter.format(new Date(inv.invoiceDate))}</div>
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

        <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3.5 flex items-center gap-2 font-heading text-[14.5px] font-semibold">
            <Slash />
            Your requests
          </h3>
          {openRequests.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {openRequests.slice(0, 5).map((r) => (
                <Link key={r.id} href={`/tenant/maintenance/${r.id}`} className="flex items-center justify-between text-[13px] hover:text-primary">
                  <span className="truncate">{r.title}</span>
                  <StatusChip tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</StatusChip>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing open right now.</p>
          )}
          <div className="mt-4 rounded-[12px] bg-accent p-3.5 text-[13px]">
            <p className="mb-2 font-medium text-accent-foreground">Something broken?</p>
            <Button size="sm" render={<Link href="/tenant/maintenance" />}>
              Report an issue
            </Button>
          </div>
        </div>
      </div>

      {otherLeases.length > 0 && (
        <p className="text-xs text-muted-foreground">
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
