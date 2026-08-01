"use client";

import { useParams } from "next/navigation";
import { useMaintenanceRequest, useMaintenanceComments } from "@/hooks/use-maintenance";
import { StatusChip } from "@/components/status-chip";
import { dateFormatter } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Being reviewed",
  PROPOSAL_CREATED: "Being reviewed",
  PENDING_OWNER_APPROVAL: "Being reviewed",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repair complete",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function TenantMaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(id);
  const { data: comments } = useMaintenanceComments(id);

  if (isLoading || !request) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-[700px]">
      <div className="mb-5">
        <h1 className="mb-1 text-[22px] font-semibold">{request.title}</h1>
        <p className="text-[13px] text-muted-foreground">Reported {dateFormatter.format(new Date(request.createdAt))}</p>
      </div>

      <div className="mb-5 rounded-[14px] border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted-foreground">Status</span>
          <StatusChip tone={request.status === "COMPLETED" ? "done" : request.status === "CANCELLED" ? "unpaid" : "progress"}>
            {STATUS_LABEL[request.status]}
          </StatusChip>
        </div>
        <p className="text-[13.5px]">{request.description}</p>
      </div>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold">Updates</h3>
        <div className="flex flex-col gap-2">
          {comments?.map((c) => (
            <div key={c.id} className="rounded-[12px] border border-border bg-card p-3 text-[13px] shadow-sm">
              {c.body}
              <div className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(c.createdAt))}</div>
            </div>
          ))}
          {comments?.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
        </div>
      </div>
    </div>
  );
}
