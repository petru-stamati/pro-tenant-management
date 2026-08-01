type Tone = "paid" | "partial" | "unpaid" | "open" | "progress" | "done";

/** How many days before endDate the countdown label kicks in. */
const EXPIRY_WARNING_DAYS = 60;

/**
 * Derives what the lease's term actually looks like *today*, independent of
 * the stored `status` (which only tracks DRAFT/ACTIVE/ENDED/TERMINATED —
 * nothing flips it automatically as endDate passes). Only meaningful for a
 * lease whose stored status is ACTIVE; DRAFT/ENDED/TERMINATED should keep
 * showing their own label instead of this.
 */
export function leaseTermStatus(endDate: string, autoRenewal: boolean): { label: string; tone: Tone } {
  const end = new Date(endDate);
  const now = new Date();
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((endMidnight.getTime() - nowMidnight.getTime()) / 86_400_000);

  if (daysLeft < 0) {
    return autoRenewal ? { label: "Auto-renewal", tone: "progress" } : { label: "Expired", tone: "unpaid" };
  }
  if (daysLeft === 0) {
    return { label: "Expires today", tone: "partial" };
  }
  if (daysLeft <= EXPIRY_WARNING_DAYS) {
    return { label: `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, tone: "partial" };
  }
  return { label: "Active", tone: "paid" };
}
