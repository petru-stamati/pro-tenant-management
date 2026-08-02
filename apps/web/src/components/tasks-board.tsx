"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useTask,
  useCreateTask,
  useUpdateTask,
  useCreateTaskComment,
  useCompleteLeaseSigning,
  type Task,
  type TaskStatus,
} from "@/hooks/use-tasks";
import { useRenewLease } from "@/hooks/use-leases";
import { useOpenItems, TASK_STATUS_LABEL, type UnifiedItem } from "@/hooks/use-open-items";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useCreateTenant } from "@/hooks/use-tenants";
import { useAuth } from "@/lib/auth-context";
import { useDocuments, useUploadDocument, downloadDocument } from "@/hooks/use-documents";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { dateFormatter } from "@/lib/format";

export function TasksBoard({ role }: { role: "PM" | "OWNER" }) {
  const router = useRouter();
  const [showClosed, setShowClosed] = useState(false);
  const { items: allItems, openItems, isLoading } = useOpenItems(role);
  const { data: owners } = useOwners();
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const items = showClosed ? allItems : openItems;

  const ownerName = (ownerId: string | null) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";

  function handleRowClick(item: UnifiedItem) {
    if (item.kind === "maintenance") {
      router.push(item.href);
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

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || parts[0] };
}

function NewTaskDialog({ role }: { role: "PM" | "OWNER" }) {
  const [open, setOpen] = useState(false);
  const { data: owners } = useOwners();
  const create = useCreateTask();
  const createTenant = useCreateTenant();
  const upload = useUploadDocument();
  const [ownerId, setOwnerId] = useState("");
  const { data: apartments } = useApartments(role === "PM" ? { ownerId: ownerId || undefined } : {});
  const [kind, setKind] = useState<"GENERAL" | "LEASE_SIGNING">("GENERAL");
  const [apartmentId, setApartmentId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [assignedToRole, setAssignedToRole] = useState<"OWNER" | "ADMIN">("OWNER");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vacantApartments = (apartments?.data ?? []).filter((a) => a.status === "VACANT");

  function resetForm() {
    setOpen(false);
    setKind("GENERAL");
    setOwnerId("");
    setApartmentId("");
    setTenantName("");
    setTitle("");
    setDescription("");
    setUrgent(false);
    setAssignedToRole("OWNER");
    setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (kind === "LEASE_SIGNING") {
        const apartment = apartments?.data.find((a) => a.id === apartmentId);
        const { firstName, lastName } = splitName(tenantName);
        const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "tenant";
        const tenant = await createTenant.mutateAsync({
          firstName,
          lastName,
          email: `${slug}.${Date.now()}@placeholder.tenant`,
        });
        const task = await create.mutateAsync({
          ownerId: role === "PM" ? ownerId : undefined,
          apartmentId,
          tenantId: tenant.id,
          kind: "LEASE_SIGNING",
          title: `Lease signing — ${apartment?.name ?? ""}`,
          description: description || `${tenantName} wants to rent this apartment.`,
          urgent,
          assignedToRole: "ADMIN",
        });
        if (file) {
          await upload.mutateAsync({ file, category: "CONTRACT", taskId: task.id });
        }
        toast.success("Lease signing started");
        resetForm();
        return;
      }

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
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const saving = create.isPending || createTenant.isPending || upload.isPending;
  const canSubmit =
    kind === "LEASE_SIGNING"
      ? apartmentId && tenantName.trim() && (role === "OWNER" || ownerId)
      : title && description && (role === "OWNER" || ownerId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New task</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => { setKind((v as typeof kind) ?? "GENERAL"); setApartmentId(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General task</SelectItem>
                <SelectItem value="LEASE_SIGNING">Lease signing — new tenant wants to rent a unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

          {kind === "LEASE_SIGNING" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label>Apartment</Label>
                <Select value={apartmentId} onValueChange={(v) => setApartmentId(v ?? "")} disabled={role === "PM" && !ownerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={vacantApartments.length === 0 ? "No vacant apartments" : "Select a vacant apartment"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vacantApartments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tenant name</Label>
                <Input required value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Requirements / notes — optional</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. wants to negotiate rent, needs a TV in the unit…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Attach the tenant&rsquo;s ID or a draft contract below if you have it — assigned to the PM to gather documents and send for signature.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}

          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            Urgent
          </label>
          <div className="flex flex-col gap-2">
            <Label>{kind === "LEASE_SIGNING" ? "Tenant ID / draft contract — optional" : "Attachment — optional"}</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? "Saving…" : kind === "LEASE_SIGNING" ? "Start lease signing" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}
function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TaskDetailDialog({ task: initialTask, onClose }: { task: Task; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // The row click only has the list snapshot (no comments — only the single-task
  // fetch includes those), so this dialog needs its own live fetch to actually
  // show the thread and stay current after a status change or new comment.
  const { data: liveTask } = useTask(initialTask.id);
  const task = liveTask ?? initialTask;
  const update = useUpdateTask(task.id);
  const createComment = useCreateTaskComment(task.id);
  const { data: documents } = useDocuments({ taskId: task.id });
  const upload = useUploadDocument();
  const renew = useRenewLease(task.leaseId ?? "__none__");
  const completeSigning = useCompleteLeaseSigning(task.id);
  const [comment, setComment] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [renewForm, setRenewForm] = useState({ startDate: "", endDate: "", rentAmountEUR: "" });
  const [renewalFile, setRenewalFile] = useState<File | null>(null);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [showSigningForm, setShowSigningForm] = useState(false);
  const [signingForm, setSigningForm] = useState({
    startDate: "",
    endDate: "",
    rentAmountEUR: "",
    rentVatIncluded: true,
    termMonths: "12",
    autoRenewal: false,
    depositAmountEUR: "",
  });
  const [signingFile, setSigningFile] = useState<File | null>(null);
  const [signingError, setSigningError] = useState<string | null>(null);

  function openRenewForm() {
    if (task.lease) {
      const start = addDays(new Date(task.lease.endDate), 1);
      const end = addMonths(start, task.lease.termMonths ?? 12);
      setRenewForm({
        startDate: toDateInputValue(start),
        endDate: toDateInputValue(end),
        rentAmountEUR: task.lease.rentAmountEUR,
      });
    }
    setShowRenewForm(true);
  }

  function openSigningForm() {
    const start = new Date();
    const end = addMonths(start, 12);
    setSigningForm((f) => ({ ...f, startDate: toDateInputValue(start), endDate: toDateInputValue(end) }));
    setShowSigningForm(true);
  }

  async function handleStatusChange(status: TaskStatus) {
    // A lease-renewal task's "Completed" IS the renewal, and a lease-signing task's
    // "Completed" IS the lease being created — route both through the same mutations
    // the Leases tab uses so the two tabs can never disagree with each other.
    if (status === "COMPLETED" && task.kind === "LEASE_RENEWAL" && task.leaseId) {
      openRenewForm();
      return;
    }
    if (status === "COMPLETED" && task.kind === "LEASE_SIGNING") {
      openSigningForm();
      return;
    }
    try {
      await update.mutateAsync({ status });
      toast.success("Status updated");
    } catch {
      toast.error("Could not update status");
    }
  }

  async function handleReassign() {
    try {
      await update.mutateAsync({ assignedToRole: task.assignedToRole === "ADMIN" ? "OWNER" : "ADMIN" });
      toast.success(task.assignedToRole === "ADMIN" ? "Sent to Owner" : "Sent to PM");
    } catch {
      toast.error("Could not reassign");
    }
  }

  async function handleCompleteRenewal(e: React.FormEvent) {
    e.preventDefault();
    if (!task.leaseId) return;
    setRenewError(null);
    try {
      const renewed = await renew.mutateAsync({
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        rentAmountEUR: Number(renewForm.rentAmountEUR),
      });
      if (renewalFile) {
        await upload.mutateAsync({ file: renewalFile, category: "RENEWAL", leaseId: renewed.id });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Lease renewed — task completed");
      setShowRenewForm(false);
      setRenewalFile(null);
    } catch (err) {
      setRenewError(err instanceof ApiError ? err.message : "Could not renew the lease.");
    }
  }

  async function handleCompleteSigning(e: React.FormEvent) {
    e.preventDefault();
    setSigningError(null);
    try {
      const lease = await completeSigning.mutateAsync({
        startDate: signingForm.startDate,
        endDate: signingForm.endDate,
        rentAmountEUR: Number(signingForm.rentAmountEUR),
        rentVatIncluded: signingForm.rentVatIncluded,
        termMonths: signingForm.termMonths ? Number(signingForm.termMonths) : undefined,
        autoRenewal: signingForm.autoRenewal,
        depositAmountEUR: Number(signingForm.depositAmountEUR),
      });
      if (signingFile) {
        await upload.mutateAsync({ file: signingFile, category: "CONTRACT", leaseId: lease.id });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Lease signed — apartment is now rented");
      setShowSigningForm(false);
      setSigningFile(null);
    } catch (err) {
      setSigningError(err instanceof ApiError ? err.message : "Could not finalize the lease.");
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
            <div className="flex items-center gap-2">
              <span className={waitingOnMe ? "font-semibold text-primary" : undefined}>
                {task.assignedToRole === "ADMIN" ? "PM" : "Owner"}
                {waitingOnMe ? " (you)" : ""}
              </span>
              {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
                <Button type="button" size="sm" variant="outline" onClick={handleReassign} disabled={update.isPending}>
                  {task.assignedToRole === "ADMIN" ? "Send to Owner" : "Send to PM"}
                </Button>
              )}
            </div>
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
            {task.kind === "LEASE_RENEWAL" && task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
              <p className="text-[11.5px] text-muted-foreground">
                This is a lease renewal task — marking it Completed will renew the lease.
              </p>
            )}
            {task.kind === "LEASE_SIGNING" && task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
              <p className="text-[11.5px] text-muted-foreground">
                This is a lease signing task — marking it Completed will create the lease and mark the apartment rented.
              </p>
            )}
          </div>

          {showRenewForm && (
            <form onSubmit={handleCompleteRenewal} className="flex flex-col gap-3 rounded-md border border-border bg-accent/20 p-3">
              <p className="text-[12.5px] font-medium">Complete lease renewal</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    required
                    value={renewForm.startDate}
                    onChange={(e) => setRenewForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    required
                    value={renewForm.endDate}
                    onChange={(e) => setRenewForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Rent (EUR, VAT incl.)</Label>
                <Input
                  type="number"
                  required
                  value={renewForm.rentAmountEUR}
                  onChange={(e) => setRenewForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Signed addendum / extension — optional</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setRenewalFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {renewError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{renewError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowRenewForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={renew.isPending || upload.isPending}>
                  {renew.isPending || upload.isPending ? "Renewing…" : "Renew & complete"}
                </Button>
              </div>
            </form>
          )}

          {showSigningForm && (
            <form onSubmit={handleCompleteSigning} className="flex flex-col gap-3 rounded-md border border-border bg-accent/20 p-3">
              <p className="text-[12.5px] font-medium">Complete lease signing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    required
                    value={signingForm.startDate}
                    onChange={(e) => setSigningForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    required
                    value={signingForm.endDate}
                    onChange={(e) => setSigningForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Rent (EUR)</Label>
                  <Input
                    type="number"
                    required
                    value={signingForm.rentAmountEUR}
                    onChange={(e) => setSigningForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Deposit (EUR)</Label>
                  <Input
                    type="number"
                    required
                    value={signingForm.depositAmountEUR}
                    onChange={(e) => setSigningForm((f) => ({ ...f, depositAmountEUR: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Term (months)</Label>
                <Input
                  type="number"
                  min={1}
                  value={signingForm.termMonths}
                  onChange={(e) => setSigningForm((f) => ({ ...f, termMonths: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={signingForm.rentVatIncluded}
                  onChange={(e) => setSigningForm((f) => ({ ...f, rentVatIncluded: e.target.checked }))}
                />
                Rent amount is VAT incl.
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={signingForm.autoRenewal}
                  onChange={(e) => setSigningForm((f) => ({ ...f, autoRenewal: e.target.checked }))}
                />
                Auto-renewal clause
              </label>
              <div className="flex flex-col gap-2">
                <Label>Signed contract — optional</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSigningFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {signingError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{signingError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSigningForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={completeSigning.isPending || upload.isPending}>
                  {completeSigning.isPending || upload.isPending ? "Saving…" : "Sign & complete"}
                </Button>
              </div>
            </form>
          )}

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
