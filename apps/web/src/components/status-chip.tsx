import { cn } from "@/lib/utils";

const TONES = {
  paid: "bg-accent text-accent-foreground",
  partial: "bg-[var(--status-amber-soft)] text-[var(--status-amber)]",
  unpaid: "bg-destructive/10 text-destructive",
  open: "bg-[var(--status-amber-soft)] text-[var(--status-amber)]",
  progress: "bg-[var(--status-blue-soft)] text-[var(--status-blue)]",
  done: "bg-accent text-accent-foreground",
} as const;

export function StatusChip({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold", TONES[tone])}>
      {children}
    </span>
  );
}

export function apartmentStatusTone(status: "VACANT" | "OCCUPIED"): keyof typeof TONES {
  return status === "OCCUPIED" ? "paid" : "open";
}

export function paymentStatusTone(status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "LATE"): keyof typeof TONES {
  if (status === "PAID") return "paid";
  if (status === "PARTIALLY_PAID") return "partial";
  return "unpaid";
}
