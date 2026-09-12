"use client";

import Link from "next/link";
import { useTasks, type TaskKind } from "@/hooks/use-tasks";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TASK_KIND_LABEL: Record<TaskKind, string> = {
  GENERAL: "Task created",
  LEASE_RENEWAL: "Lease renewal started",
  LEASE_SIGNING: "Lease signing started",
  MOVE_OUT_INSPECTION: "Move-out inspection started",
};

const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Sent to Owner for approval",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

interface ActivityEvent {
  id: string;
  at: string;
  label: string;
  text: string;
  href?: string;
}

/**
 * A single chronological feed of everything that's happened to this
 * apartment — move-out inspections, the comments logged on them, the
 * maintenance tasks spun off from those comments, every quote/approval
 * step, and the back-and-forth comments on each — so a PM or Owner can see
 * the whole story in one place instead of piecing it together from
 * separate Tasks and Maintenance tabs.
 */
export function ApartmentActivityTab({ apartmentId, role }: { apartmentId: string; role: "PM" | "OWNER" }) {
  const { data: tasks, isLoading: tasksLoading } = useTasks({ apartmentId });
  const { data: requests, isLoading: requestsLoading } = useMaintenanceRequests({ apartmentId });

  if (tasksLoading || requestsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const events: ActivityEvent[] = [];

  for (const t of tasks?.data ?? []) {
    events.push({ id: `task-${t.id}-created`, at: t.createdAt, label: TASK_KIND_LABEL[t.kind], text: t.title });
    for (const c of t.comments ?? []) {
      events.push({
        id: `task-comment-${c.id}`,
        at: c.createdAt,
        label: "Comment",
        text: `${c.author ? `${c.author.firstName} ${c.author.lastName}` : "—"}: ${c.body}`,
      });
    }
  }

  for (const r of requests?.data ?? []) {
    const href = role === "PM" ? `/pm/maintenance/${r.id}` : `/owner/maintenance/${r.id}`;
    events.push({ id: `maint-${r.id}-created`, at: r.createdAt, label: "Maintenance task created", text: r.title, href });
    for (const se of r.statusEvents ?? []) {
      events.push({
        id: `maint-status-${se.id}`,
        at: se.createdAt,
        label: "Status change",
        text: `${r.title}: ${MAINTENANCE_STATUS_LABEL[se.toStatus] ?? se.toStatus}${se.note ? ` — ${se.note}` : ""}`,
        href,
      });
    }
    for (const c of r.comments ?? []) {
      events.push({
        id: `maint-comment-${c.id}`,
        at: c.createdAt,
        label: "Comment",
        text: `${c.author ? `${c.author.firstName} ${c.author.lastName}` : "—"}: ${c.body}`,
        href,
      });
    }
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (events.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        No activity yet — inspections, tasks, and maintenance updates for this apartment will show up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((e) => (
        <div key={e.id} className="rounded-[12px] border border-border bg-card p-3 shadow-sm text-[13px]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {e.label}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{dateTimeFormatter.format(new Date(e.at))}</span>
          </div>
          {e.href ? (
            <Link href={e.href} className="block hover:underline">
              {e.text}
            </Link>
          ) : (
            <p>{e.text}</p>
          )}
        </div>
      ))}
    </div>
  );
}
