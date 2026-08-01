"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useMaintenanceRequests, useCreateMaintenanceRequest } from "@/hooks/use-maintenance";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { dateFormatter } from "@/lib/format";

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

export default function MaintenancePage() {
  const { data: requests, isLoading } = useMaintenanceRequests();

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Maintenance</h1>
          <p className="text-[13.5px] text-muted-foreground">{requests?.data.length ?? 0} requests</p>
        </div>
        <CreateRequestDialog />
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests && requests.data.length > 0 ? (
          requests.data.map((r) => (
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

function CreateRequestDialog() {
  const [open, setOpen] = useState(false);
  const { data: apartments } = useApartments();
  const create = useCreateMaintenanceRequest();
  const [form, setForm] = useState({ apartmentId: "", title: "", description: "", urgent: false });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(form);
      toast.success("Maintenance request created");
      setOpen(false);
      setForm({ apartmentId: "", title: "", description: "", urgent: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Report issue</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Apartment</Label>
            <Select value={form.apartmentId} onValueChange={(v) => setForm((f) => ({ ...f, apartmentId: v ?? "" }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select an apartment" />
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.urgent}
              onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))}
            />
            Mark as urgent
          </label>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.apartmentId}>
              {create.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
