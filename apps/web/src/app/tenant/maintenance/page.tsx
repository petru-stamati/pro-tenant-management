"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMaintenanceRequests, useCreateMaintenanceRequest } from "@/hooks/use-maintenance";
import { useUploadDocument } from "@/hooks/use-documents";
import { useMyLeases } from "@/hooks/use-leases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { dateFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const STATUS_TONE: Record<string, "open" | "progress" | "done" | "unpaid"> = {
  REPORTED: "open",
  TRIAGED: "progress",
  PROPOSAL_CREATED: "progress",
  PENDING_OWNER_APPROVAL: "progress",
  IN_PROGRESS: "progress",
  REPAIRED: "progress",
  COMPLETED: "done",
  CANCELLED: "unpaid",
};

const STEPS = ["Reported", "Being reviewed", "In progress", "Repair complete", "Completed"];
const STEP_INDEX: Record<string, number> = {
  REPORTED: 0,
  TRIAGED: 1,
  PROPOSAL_CREATED: 1,
  PENDING_OWNER_APPROVAL: 1,
  IN_PROGRESS: 2,
  REPAIRED: 3,
  COMPLETED: 4,
  CANCELLED: 4,
};

function ProgressBar({ status }: { status: string }) {
  if (status === "CANCELLED") return <StatusChip tone="unpaid">Cancelled</StatusChip>;
  const idx = STEP_INDEX[status] ?? 0;
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-primary" : "bg-muted")} />
          <span className={cn("text-center text-[9.5px] leading-tight", i === idx ? "font-medium text-foreground" : "text-muted-foreground")}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TenantMaintenancePage() {
  const { data: requests, isLoading } = useMaintenanceRequests();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5">
        <h1 className="font-heading text-[23px] font-semibold">Report an Issue</h1>
        <p className="text-[13.5px] text-muted-foreground">Your maintenance requests</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : requests && requests.data.length > 0 ? (
            requests.data.map((r) => (
              <Link
                key={r.id}
                href={`/tenant/maintenance/${r.id}`}
                className="block rounded-[14px] border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Reported {dateFormatter.format(new Date(r.createdAt))}</p>
                  </div>
                  <StatusChip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusChip>
                </div>
                <ProgressBar status={r.status} />
              </Link>
            ))
          ) : (
            <div className="rounded-[14px] border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              You haven&apos;t reported any issues yet.
            </div>
          )}
        </div>

        <Suspense fallback={null}>
          <ReportIssueForm />
        </Suspense>
      </div>
    </div>
  );
}

function ReportIssueForm() {
  const searchParams = useSearchParams();
  const preselectedApartmentId = searchParams.get("apartmentId") ?? "";
  const { data: leases } = useMyLeases();
  const create = useCreateMaintenanceRequest();
  const upload = useUploadDocument();
  const [form, setForm] = useState({ apartmentId: preselectedApartmentId, title: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeLeases = leases?.data.filter((l) => l.status === "ACTIVE") ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await create.mutateAsync(form);
      if (file) {
        await upload.mutateAsync({ file, category: "MAINTENANCE", maintenanceRequestId: created.id });
      }
      toast.success("Issue reported — the property manager has been notified");
      setForm({ apartmentId: "", title: "", description: "" });
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="h-fit rounded-[16px] border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-heading text-[15px] font-semibold">What&rsquo;s wrong?</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {activeLeases.length > 1 && (
          <div className="flex flex-col gap-2">
            <Label>Apartment</Label>
            <Select value={form.apartmentId} onValueChange={(v) => setForm((f) => ({ ...f, apartmentId: v ?? "" }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select an apartment" />
              </SelectTrigger>
              <SelectContent>
                {activeLeases.map((l) => (
                  <SelectItem key={l.apartment.id} value={l.apartment.id}>
                    {l.apartment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Boiler not heating"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Details</Label>
          <Textarea
            id="description"
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Add a photo or video — optional</Label>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[12px] border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted-foreground hover:border-primary">
            {file ? file.name : "Click to choose a file"}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={create.isPending || upload.isPending || !form.apartmentId}
          className="mt-1 h-11 gap-2"
        >
          <span className="inline-block h-3.5 w-1 -skew-x-[16deg] rounded-[1px] bg-primary-foreground" />
          {create.isPending || upload.isPending ? "Sending…" : "Send to property manager"}
        </Button>
      </form>
    </div>
  );
}
