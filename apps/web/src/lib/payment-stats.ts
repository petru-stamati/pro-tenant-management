import type { ApartmentInvoice } from "@/hooks/use-apartment-invoices";

export interface PaymentStats {
  onTimeRate: number | null;
  avgDaysLate: number | null;
  overdueCount: number;
  paidCount: number;
}

/**
 * How reliably rent/invoices got paid, computed from each fully-paid
 * invoice's last payment date vs. its due date — "when did the money
 * actually land" rather than just "is it paid". Pass invoices already
 * filtered to whichever scope matters (one lease/tenant, or a whole
 * apartment's history).
 */
export function computePaymentStats(invoices: ApartmentInvoice[]): PaymentStats {
  const paidInvoices = invoices.filter((inv) => inv.status === "PAID" && (inv.applications?.length ?? 0) > 0);
  const daysLateList = paidInvoices.map((inv) => {
    const lastPaymentMs = inv.applications!.reduce(
      (latest, app) => Math.max(latest, new Date(app.paymentConfirmation.paymentDate).getTime()),
      0,
    );
    const dueMs = new Date(inv.dueDate).getTime();
    return Math.round((lastPaymentMs - dueMs) / 86_400_000);
  });
  const onTimeRate =
    paidInvoices.length > 0 ? Math.round((daysLateList.filter((d) => d <= 0).length / paidInvoices.length) * 100) : null;
  const avgDaysLate =
    daysLateList.length > 0 ? Math.round(daysLateList.reduce((sum, d) => sum + d, 0) / daysLateList.length) : null;
  const overdueCount = invoices.filter((inv) => inv.status !== "PAID" && new Date(inv.dueDate).getTime() < Date.now()).length;
  return { onTimeRate, avgDaysLate, overdueCount, paidCount: paidInvoices.length };
}

/** Compact one-line label + color for glance views (apartment overview card, tenant history row). */
export function paymentReliabilitySummary(
  stats: PaymentStats,
): { text: string; tone: "open" | "progress" | "done" | "unpaid" } {
  if (stats.overdueCount > 0) {
    return { text: `${stats.overdueCount} overdue`, tone: "unpaid" };
  }
  if (stats.paidCount === 0) {
    return { text: "No history yet", tone: "open" };
  }
  const late = stats.avgDaysLate ?? 0;
  if (late <= 0) {
    return { text: late < 0 ? `On time (${Math.abs(late)}d early avg)` : "On time", tone: "done" };
  }
  if (late <= 5) {
    return { text: `~${late}d late on avg`, tone: "progress" };
  }
  return { text: `~${late}d late on avg`, tone: "unpaid" };
}
