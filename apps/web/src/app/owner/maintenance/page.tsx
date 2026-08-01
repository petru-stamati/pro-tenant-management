"use client";

import Link from "next/link";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { StatusChip } from "@/components/status-chip";
import { dateFormatter } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Awaiting your approval",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<string, "open" | "progress" | "done" | "unpaid"> = {
  REPORTED: "open",
  TRIAGED: "open",
  PROPOSAL_CREATED: "progress",
  PENDING_OWNER_APPROVAL: "progress",
  IN_PROGRESS: "progress",
  REPAIRED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

export default function OwnerMaintenancePage() {
  const { data: requests, isLoading } = useMaintenanceRequests();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Maintenance</h1>
        <p className="text-[13.5px] text-muted-foreground">{requests?.data.length ?? 0} requests</p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests && requests.data.length > 0 ? (
          requests.data.map((r) => (
            <Link
              key={r.id}
              href={`/owner/maintenance/${r.id}`}
              className="block rounded-[14px] border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {r.title} {r.urgent && <StatusChip tone="unpaid">Urgent</StatusChip>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.apartment?.name} · {dateFormatter.format(new Date(r.createdAt))}
                  </p>
                </div>
                <StatusChip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusChip>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            No maintenance requests yet.
          </div>
        )}
      </div>
    </div>
  );
}
