"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { useMaintenanceRequests, type MaintenanceRequestSummary, type MaintenanceStatus } from "@/hooks/use-maintenance";
import { CreateMaintenanceRequestDialog } from "@/components/create-maintenance-request-dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { Slash } from "@/components/ui/slash";
import { dateFormatter, formatRON } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Pending approval",
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

const BOARD_COLUMNS: MaintenanceStatus[] = [
  "REPORTED",
  "TRIAGED",
  "PROPOSAL_CREATED",
  "PENDING_OWNER_APPROVAL",
  "IN_PROGRESS",
  "REPAIRED",
];

const COLUMN_SLASH: Record<string, string> = {
  REPORTED: "bg-[#6b7169]",
  TRIAGED: "bg-info",
  PROPOSAL_CREATED: "bg-warning",
  PENDING_OWNER_APPROVAL: "bg-warning",
  IN_PROGRESS: "bg-primary",
  REPAIRED: "bg-primary",
};

function ageLabel(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d`;
}

function waitingOn(status: MaintenanceStatus): string | null {
  if (status === "COMPLETED" || status === "CANCELLED") return null;
  return status === "PENDING_OWNER_APPROVAL" ? "Owner" : "PM";
}

function latestCost(r: MaintenanceRequestSummary): string | null {
  const p = r.proposals?.[r.proposals.length - 1];
  return p ? formatRON(p.costEUR) : null;
}

function MaintenanceCard({ r, basePath }: { r: MaintenanceRequestSummary; basePath: string }) {
  const cost = latestCost(r);
  const waiting = waitingOn(r.status);
  return (
    <Link
      href={`${basePath}/${r.id}`}
      className="block rounded-[11px] border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-[0_8px_24px_rgba(20,23,15,.08)]"
    >
      {r.urgent && (
        <span className="mb-1.5 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-destructive uppercase">
          Urgent
        </span>
      )}
      <div className="truncate text-[13px] font-medium">{r.title}</div>
      <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{r.apartment?.name ?? "—"}</div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-mono text-muted-foreground">{ageLabel(r.createdAt)}</span>
        {cost && <span className="font-mono-tabular font-mono font-semibold">{cost}</span>}
      </div>
      {waiting && (
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-divider pt-1.5 text-[11px] text-muted-foreground">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-accent-foreground">
            {waiting[0]}
          </span>
          Waiting on {waiting}
        </div>
      )}
    </Link>
  );
}

export default function MaintenancePage() {
  const { data: requests, isLoading } = useMaintenanceRequests();
  const [view, setView] = useState<"board" | "list">("board");
  const [showArchived, setShowArchived] = useState(false);

  const byStatus = useMemo(() => {
    const map = new Map<MaintenanceStatus, MaintenanceRequestSummary[]>();
    for (const r of requests?.data ?? []) {
      const list = map.get(r.status) ?? [];
      list.push(r);
      map.set(r.status, list);
    }
    return map;
  }, [requests]);

  const archived = (requests?.data ?? []).filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");
  const urgentCount = (requests?.data ?? []).filter((r) => r.urgent).length;
  const awaitingRON = (requests?.data ?? [])
    .filter((r) => r.status === "PENDING_OWNER_APPROVAL")
    .reduce((sum, r) => sum + Number(r.proposals?.[r.proposals.length - 1]?.costEUR ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 font-mono text-[12px] font-medium tracking-[1px] text-muted-foreground uppercase">
        {requests?.data.length ?? 0} open · {urgentCount} urgent · {formatRON(awaitingRON)} awaiting approval
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-[23px] font-semibold">Maintenance</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn("rounded-md p-1.5", view === "board" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn("rounded-md p-1.5", view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
          <CreateMaintenanceRequestDialog trigger={<Button>+ Report issue</Button>} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !requests || requests.data.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No maintenance requests yet.
        </div>
      ) : view === "board" ? (
        <>
          <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6">
            {BOARD_COLUMNS.map((status) => {
              const items = byStatus.get(status) ?? [];
              return (
                <div key={status} className="flex min-w-0 flex-col gap-2 rounded-[14px] bg-[#eef0ec] p-2.5">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <Slash className={COLUMN_SLASH[status]} />
                    <span className="text-[12px] font-semibold">{STATUS_LABEL[status]}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((r) => (
                      <MaintenanceCard key={r.id} r={r} basePath="/pm/maintenance" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {archived.length > 0 && (
            <div className="mt-4 rounded-[14px] border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-between text-[13px] font-medium"
              >
                <span>
                  {archived.filter((r) => r.status === "COMPLETED").length} completed ·{" "}
                  {archived.filter((r) => r.status === "CANCELLED").length} cancelled
                </span>
                <span className="text-muted-foreground">{showArchived ? "Hide" : "Show"}</span>
              </button>
              {showArchived && (
                <div className="mt-3 flex flex-col gap-2">
                  {archived.map((r) => (
                    <Link
                      key={r.id}
                      href={`/pm/maintenance/${r.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px] hover:border-primary"
                    >
                      <span>
                        {r.title} · {r.apartment?.name}
                      </span>
                      <StatusChip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusChip>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.data.map((r) => (
            <Link
              key={r.id}
              href={`/pm/maintenance/${r.id}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
