"use client";

import { useMemo, useState } from "react";
import { useApartment } from "@/hooks/use-apartments";
import { useApartmentInvoices, type ApartmentInvoice } from "@/hooks/use-apartment-invoices";
import { useTasks } from "@/hooks/use-tasks";
import { TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/hooks/use-open-items";
import { InvoiceDetailDialog, TYPE_LABEL, monthLabel } from "@/components/payments-board";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { formatRON } from "@/lib/format";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

interface ActivityEntry {
  key: string;
  date: string;
  text: string;
  tone: "open" | "progress" | "done" | "unpaid";
}

/**
 * "Full financial situation" for one apartment — invoices/payments, tasks,
 * and a merged recent-activity feed — reused as-is on both the PM and Owner
 * apartment detail pages so the two never drift apart. Derived entirely from
 * existing Tasks + ApartmentInvoice/PaymentConfirmation data, no separate
 * audit-log table.
 */
export function ApartmentFinancialsTab({ apartmentId, canEdit }: { apartmentId: string; canEdit: boolean }) {
  const { data: apartment } = useApartment(apartmentId);
  const { data: invoices, isLoading: invoicesLoading } = useApartmentInvoices({ apartmentId });
  const { data: tasks, isLoading: tasksLoading } = useTasks({ apartmentId });
  const [detailInvoice, setDetailInvoice] = useState<ApartmentInvoice | null>(null);

  const sortedInvoices = useMemo(
    () => [...(invoices?.data ?? [])].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)),
    [invoices],
  );

  const totals = useMemo(() => {
    const outstanding = sortedInvoices.reduce((sum, inv) => sum + Number(inv.outstandingAmountRON), 0);
    const paid = sortedInvoices.reduce((sum, inv) => sum + Number(inv.paidAmountRON), 0);
    return { outstanding, paid };
  }, [sortedInvoices]);

  const sortedTasks = useMemo(
    () =>
      [...(tasks?.data ?? [])].sort((a, b) => {
        const aOpen = a.status !== "COMPLETED" && a.status !== "CANCELLED";
        const bOpen = b.status !== "COMPLETED" && b.status !== "CANCELLED";
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [tasks],
  );

  const activity = useMemo<ActivityEntry[]>(() => {
    const taskEvents: ActivityEntry[] = (tasks?.data ?? []).map((t) => ({
      key: `task-${t.id}`,
      date: t.updatedAt,
      text: `${t.title} — ${TASK_STATUS_LABEL[t.status]}`,
      tone: TASK_STATUS_TONE[t.status],
    }));
    const paymentEvents: ActivityEntry[] = sortedInvoices.flatMap((inv) =>
      (inv.applications ?? []).map((app) => ({
        key: `payment-${app.id}`,
        date: app.paymentConfirmation.paymentDate,
        text: `${formatRON(app.amountRON)} paid toward ${TYPE_LABEL[inv.type]} (${monthLabel(inv.periodMonth.slice(0, 7))})`,
        tone: "done" as const,
      })),
    );
    return [...taskEvents, ...paymentEvents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [tasks, sortedInvoices]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryStat label="Outstanding" value={formatRON(totals.outstanding)} />
        <SummaryStat label="Paid to date" value={formatRON(totals.paid)} />
        <SummaryStat label="Credit balance" value={formatRON(Number(apartment?.creditBalanceRON ?? 0))} />
      </div>

      <Panel title="Invoices & payments">
        {invoicesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sortedInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortedInvoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setDetailInvoice(inv)}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left text-[13px] hover:border-primary"
              >
                <div>
                  <div className="font-medium">
                    {TYPE_LABEL[inv.type]} · {monthLabel(inv.periodMonth.slice(0, 7))}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">due {dateFormatter.format(new Date(inv.dueDate))}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular font-mono">{formatRON(inv.totalAmountRON)}</span>
                  <StatusChip tone={paymentStatusTone(inv.status)}>{inv.status.replace("_", " ").toLowerCase()}</StatusChip>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Tasks">
        {tasksLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sortedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks for this apartment yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortedTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
                <span className="font-medium">{t.title}</span>
                <StatusChip tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABEL[t.status]}</StatusChip>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {activity.map((a) => (
              <div key={a.key} className="flex items-center justify-between py-2 text-[13px]">
                <span>{a.text}</span>
                <span className="text-[11.5px] text-muted-foreground">{dateFormatter.format(new Date(a.date))}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {detailInvoice && <InvoiceDetailDialog invoice={detailInvoice} canEdit={canEdit} onClose={() => setDetailInvoice(null)} />}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3">
      <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="font-mono-tabular font-mono text-[16px] font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-3 text-[14.5px] font-semibold">{title}</h3>
      {children}
    </div>
  );
}
