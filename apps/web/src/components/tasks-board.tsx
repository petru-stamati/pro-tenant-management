"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useCreateTaskComment,
  type Task,
  type TaskStatus,
} from "@/hooks/use-tasks";
import { useMaintenanceRequests, type MaintenanceRequestSummary, type MaintenanceStatus } from "@/hooks/use-maintenance";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useAuth } from "@/lib/auth-context";
import { useDocuments, useUploadDocument, downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { dateFormatter } from "@/lib/format";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ANSWERED: "Answered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const TASK_STATUS_TONE: Record<TaskStatus, "open" | "progress" | "done" | "unpaid"> = {
  OPEN: "open",
  IN_PROGRESS: "progress",
  ANSWERED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Waiting on owner",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, "open" | "progress" | "done" | "unpaid"> = {
  REPORTED: "open",
  TRIAGED: "open",
  PROPOSAL_CREATED: "progress",
  PENDING_OWNER_APPROVAL: "progress",
  IN_PROGRESS: "progress",
  REPAIRED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

const OPEN_TASK_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "ANSWERED"];
const OPEN_MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  "REPORTED",
  "TRIAGED",
  "PROPOSAL_CREATED",
  "PENDING_OWNER_APPROVAL",
  "IN_PROGRESS",
  "REPAIRED",
];

interface UnifiedItem {
  kind: "task" | "maintenance";
  id: string;
  title: string;
  urgent: boolean;
  statusLabel: string;
  statusTone: "open" | "progress" | "done" | "unpaid";
  apartmentName: string | null;
  ownerId: string | null;
  waitingOn: "Owner" | "PM" | null;
  createdAt: string;
  task?: Task;
}

export function TasksBoard({ role }: { role: "PM" | "OWNER" }) {
  const router = useRouter();
  const [showClosed, setShowClosed] = useState(false);
  const { data: tasksData, isLoading: tasksLoading } = useTasks();
  const { data: maintenanceData, isLoading: maintenanceLoading } = useMaintenanceRequests();
  const { data: owners } = useOwners();
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const items = useMemo<UnifiedItem[]>(() => {
    const taskItems: UnifiedItem[] = (tasksData?.data ?? []).map((t) => ({
      kind: "task",
      id: t.id,
      title: t.title,
      urgent: t.urgent,
      statusLabel: TASK_STATUS_LABEL[t.status],
      statusTone: TASK_STATUS_TONE[t.status],
      apartmentName: t.apartment?.name ?? null,
      ownerId: t.apartment?.ownerId ?? t.ownerId,
      waitingOn: t.status === "COMPLETED" || t.status === "CANCELLED" ? null : t.assignedToRole === "ADMIN" ? "PM" : "Owner",
      createdAt: t.createdAt,
      task: t,
    }));
    const maintenanceItems: UnifiedItem[] = (maintenanceData?.data ?? []).map((m: MaintenanceRequestSummary) => ({
      kind: "maintenance",
      id: m.id,
      title: m.title,
      urgent: m.urgent,
      statusLabel: MAINTENANCE_STATUS_LABEL[m.status],
      statusTone: MAINTENANCE_STATUS_TONE[m.status],
      apartmentName: m.apartment?.name ?? null,
      ownerId: m.apartment?.ownerId ?? null,
      waitingOn:
        m.status === "COMPLETED" || m.status === "CANCELLED" ? null : m.status === "PENDING_OWNER_APPROVAL" ? "Owner" : "PM",
      createdAt: m.createdAt,
    }));

    const maintenanceStatusById = new Map((maintenanceData?.data ?? []).map((m) => [m.id, m.status]));
    const merged = [...taskItems, ...maintenanceItems].filter((item) => {
      if (showClosed) return true;
      if (item.kind === "task") return OPEN_TASK_STATUSES.includes(item.task!.status);
      return OPEN_MAINTENANCE_STATUSES.includes(maintenanceStatusById.get(item.id) as MaintenanceStatus);
    });

    return merged.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasksData, maintenanceData, showClosed]);

  const ownerName = (ownerId: string | null) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";
  const isLoading = tasksLoading || maintenanceLoading;

  function handleRowClick(item: UnifiedItem) {
    if (item.kind === "maintenance") {
      router.push(role === "PM" ? `/pm/maintenance/${item.id}` : `/owner/maintenance/${item.id}`);
    } else {
      setOpenTask(item.task ?? null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Tasks</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {items.length} {showClosed ? "total" : "open"} · everything that needs a decision or an action from you
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show completed/cancelled
          </label>
          <NewTaskDialog role={role} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Type</th>
                <th className="p-3 font-medium text-muted-foreground">Apartment</th>
                <th className="p-3 font-medium text-muted-foreground">Task</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground">Waiting on</th>
                <th className="p-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.kind}-${item.id}`}
                  onClick={() => handleRowClick(item)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/30"
                >
                  <td className="p-3">
                    <span className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {item.kind === "maintenance" ? "Maintenance" : "Task"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{item.apartmentName ?? <span className="italic text-muted-foreground">General</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{ownerName(item.ownerId)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {item.urgent && (
                        <Badge variant="destructive" className="text-[10px]">
                          Urgent
                        </Badge>
                      )}
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusChip tone={item.statusTone}>{item.statusLabel}</StatusChip>
                  </td>
                  <td className="p-3 text-[12.5px] text-muted-foreground">{item.waitingOn ?? "—"}</td>
                  <td className="p-3 font-mono-tabular font-mono text-[12.5px]">{dateFormatter.format(new Date(item.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Nothing here — you're all caught up.</p>
        )}
      </div>

      {openTask && <TaskDetailDialog task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function NewTaskDialog({ role }: { role: "PM" | "OWNER" }) {
  const [open, setOpen] = useState(false);
  const { data: owners } = useOwners();
  const create = useCreateTask();
  const upload = useUploadDocument();
  const [ownerId, setOwnerId] = useState("");
  const { data: apartments } = useApartments(role === "PM" ? { ownerId: ownerId || undefined } : {});
  const [apartmentId, setApartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [assignedToRole, setAssignedToRole] = useState<"OWNER" | "ADMIN">("OWNER");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const apartment = apartments?.data.find((a) => a.id === apartmentId);
      const task = await create.mutateAsync({
        ownerId: role === "PM" ? ownerId : undefined,
        apartmentId: apartmentId || undefined,
        tenantId: apartment?.currentLease?.tenantId,
        title,
        description,
        urgent,
        assignedToRole: role === "PM" ? assignedToRole : undefined,
      });
      if (file) {
        await upload.mutateAsync({ file, category: "OTHER", taskId: task.id });
      }
      toast.success("Task created");
      setOpen(false);
      setOwnerId("");
      setApartmentId("");
      setTitle("");
      setDescription("");
      setUrgent(false);
      setAssignedToRole("OWNER");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = create.isPending || upload.isPending;
  const canSubmit = title && description && (role === "OWNER" || ownerId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New task</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {role === "PM" && (
            <div className="flex flex-col gap-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={(v) => { setOwnerId(v ?? ""); setApartmentId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners?.data.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Apartment — optional</Label>
            <Select value={apartmentId} onValueChange={(v) => setApartmentId(v ?? "")} disabled={role === "PM" && !ownerId}>
              <SelectTrigger>
                <SelectValue placeholder="General (not apartment-specific)" />
              </SelectTrigger>
              <SelectContent>
                {apartments?.data.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Title</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Description</Label>
            <Textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {role === "PM" && (
            <div className="flex flex-col gap-2">
              <Label>Assigned to</Label>
              <Select value={assignedToRole} onValueChange={(v) => setAssignedToRole((v as "OWNER" | "ADMIN") ?? "OWNER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner — needs their answer/decision</SelectItem>
                  <SelectItem value="ADMIN">Myself / PM team — internal to-do</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {role === "OWNER" && (
            <p className="text-[11.5px] text-muted-foreground">This task will be sent to your property manager.</p>
          )}
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            Urgent
          </label>
          <div className="flex flex-col gap-2">
            <Label>Attachment — optional</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({ task: initialTask, onClose }: { task: Task; onClose: () => void }) {
  const { user } = useAuth();
  // The row click only has the list snapshot (no comments — only the single-task
  // fetch includes those), so this dialog needs its own live fetch to actually
  // show the thread and stay current after a status change or new comment.
  const { data: liveTask } = useTask(initialTask.id);
  const task = liveTask ?? initialTask;
  const update = useUpdateTask(task.id);
  const createComment = useCreateTaskComment(task.id);
  const { data: documents } = useDocuments({ taskId: task.id });
  const upload = useUploadDocument();
  const [comment, setComment] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function handleStatusChange(status: TaskStatus) {
    try {
      await update.mutateAsync({ status });
      toast.success("Status updated");
    } catch {
      toast.error("Could not update status");
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await createComment.mutateAsync(comment);
      setComment("");
    } catch {
      toast.error("Could not post comment");
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category: "OTHER", taskId: task.id });
      toast.success("Attachment uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handleDownload(id: string, fileName: string) {
    setDownloading(true);
    try {
      await downloadDocument(id, fileName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const waitingOnMe =
    (user?.role === "ADMIN" && task.assignedToRole === "ADMIN") || (user?.role === "OWNER" && task.assignedToRole === "OWNER");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.urgent && (
              <Badge variant="destructive" className="text-[10px]">
                Urgent
              </Badge>
            )}
            {task.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-[13.5px]">
          <p className="text-muted-foreground">{task.description}</p>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Apartment</span>
            <span>{task.apartment?.name ?? "General"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Waiting on</span>
            <span className={waitingOnMe ? "font-semibold text-primary" : undefined}>
              {task.assignedToRole === "ADMIN" ? "PM" : "Owner"}
              {waitingOnMe ? " (you)" : ""}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select value={task.status} onValueChange={(v) => v && handleStatusChange(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>Attachments</Label>
            {documents && documents.data.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {documents.data.map((d) => (
                  <button
                    key={d.id}
                    disabled={downloading}
                    onClick={() => handleDownload(d.id, d.fileName)}
                    className="truncate rounded-md border border-border px-2.5 py-1.5 text-left text-[12.5px] hover:border-primary"
                  >
                    {d.fileName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">Nothing attached yet.</p>
            )}
            <Input type="file" accept="image/*,application/pdf" onChange={handleFile} disabled={upload.isPending} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label>Comments</Label>
            {task.comments && task.comments.length > 0 ? (
              <div className="flex max-h-[180px] flex-col gap-2 overflow-y-auto">
                {task.comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-accent/30 px-2.5 py-1.5 text-[12.5px]">
                    <div className="mb-0.5 font-medium">
                      {c.author ? `${c.author.firstName} ${c.author.lastName}` : "—"}
                    </div>
                    {c.body}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">No comments yet.</p>
            )}
            <form onSubmit={handleComment} className="flex gap-2">
              <Input
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={createComment.isPending || !comment.trim()}>
                Send
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
