import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTasks, type Task, type TaskStatus } from "./use-tasks";
import { useMaintenanceRequests, type MaintenanceRequestSummary, type MaintenanceStatus } from "./use-maintenance";

export type ItemTone = "open" | "progress" | "done" | "unpaid";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ANSWERED: "Answered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const TASK_STATUS_TONE: Record<TaskStatus, ItemTone> = {
  OPEN: "open",
  IN_PROGRESS: "progress",
  ANSWERED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Waiting on owner",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, ItemTone> = {
  REPORTED: "open",
  TRIAGED: "open",
  PROPOSAL_CREATED: "progress",
  PENDING_OWNER_APPROVAL: "progress",
  IN_PROGRESS: "progress",
  REPAIRED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

export const OPEN_TASK_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "ANSWERED"];
export const OPEN_MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  "REPORTED",
  "TRIAGED",
  "PROPOSAL_CREATED",
  "PENDING_OWNER_APPROVAL",
  "IN_PROGRESS",
  "REPAIRED",
];

export interface UnifiedItem {
  kind: "task" | "maintenance";
  id: string;
  rawStatus: TaskStatus | MaintenanceStatus;
  title: string;
  urgent: boolean;
  statusLabel: string;
  statusTone: ItemTone;
  apartmentName: string | null;
  ownerId: string | null;
  waitingOn: "Owner" | "PM" | null;
  createdAt: string;
  href: string;
  task?: Task;
}

/**
 * The single merged Task+Maintenance inbox — same "everything that needs a
 * decision or an action from you" list shown on the Tasks tab, reused for
 * the sidebar unread-style badge and the dashboard preview panel so all
 * three never disagree about what's open.
 */
export function useOpenItems(role: "PM" | "OWNER") {
  const { user } = useAuth();
  const enabled = user?.role === "ADMIN" || user?.role === "OWNER";
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ enabled });
  const { data: maintenanceData, isLoading: maintenanceLoading } = useMaintenanceRequests({ enabled });

  const items = useMemo<UnifiedItem[]>(() => {
    const base = role === "PM" ? "/pm" : "/owner";
    const taskItems: UnifiedItem[] = (tasksData?.data ?? []).map((t) => ({
      kind: "task",
      id: t.id,
      rawStatus: t.status,
      title: t.title,
      urgent: t.urgent,
      statusLabel: TASK_STATUS_LABEL[t.status],
      statusTone: TASK_STATUS_TONE[t.status],
      apartmentName: t.apartment?.name ?? null,
      ownerId: t.apartment?.ownerId ?? t.ownerId,
      waitingOn: t.status === "COMPLETED" || t.status === "CANCELLED" ? null : t.assignedToRole === "ADMIN" ? "PM" : "Owner",
      createdAt: t.createdAt,
      href: `${base}/tasks`,
      task: t,
    }));
    const maintenanceItems: UnifiedItem[] = (maintenanceData?.data ?? []).map((m: MaintenanceRequestSummary) => ({
      kind: "maintenance",
      id: m.id,
      rawStatus: m.status,
      title: m.title,
      urgent: m.urgent,
      statusLabel: MAINTENANCE_STATUS_LABEL[m.status],
      statusTone: MAINTENANCE_STATUS_TONE[m.status],
      apartmentName: m.apartment?.name ?? null,
      ownerId: m.apartment?.ownerId ?? null,
      waitingOn:
        m.status === "COMPLETED" || m.status === "CANCELLED" ? null : m.status === "PENDING_OWNER_APPROVAL" ? "Owner" : "PM",
      createdAt: m.createdAt,
      href: `${base}/maintenance/${m.id}`,
    }));

    return [...taskItems, ...maintenanceItems].sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasksData, maintenanceData, role]);

  const openItems = useMemo(
    () =>
      items.filter((item) =>
        item.kind === "task"
          ? OPEN_TASK_STATUSES.includes(item.rawStatus as TaskStatus)
          : OPEN_MAINTENANCE_STATUSES.includes(item.rawStatus as MaintenanceStatus),
      ),
    [items],
  );

  return { items, openItems, openCount: openItems.length, isLoading: enabled && (tasksLoading || maintenanceLoading) };
}
