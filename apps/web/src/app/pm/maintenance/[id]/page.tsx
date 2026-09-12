"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useMaintenanceRequest,
  useMaintenanceComments,
  useChangeMaintenanceStatus,
  useCancelMaintenanceRequest,
  useCreateProposal,
  useCreateComment,
} from "@/hooks/use-maintenance";
import { useUploadDocument, useDeleteDocument, downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { StatusChip } from "@/components/status-chip";
import { LineItemsEditor, draftsToLineItems, type LineItemDraft } from "@/components/line-items-editor";
import { ApiError } from "@/lib/api-client";
import { formatRON, dateFormatter } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Pending owner approval",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(id);
  const { data: comments } = useMaintenanceComments(id);
  const changeStatus = useChangeMaintenanceStatus(id);
  const createProposal = useCreateProposal(id);
  const createComment = useCreateComment(id);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({ contractorName: "", costEUR: "", description: "" });
  const [proposalLineItems, setProposalLineItems] = useState<LineItemDraft[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const queryClient = useQueryClient();

  if (isLoading || !request) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function markTriaged() {
    try {
      await changeStatus.mutateAsync({ toStatus: "TRIAGED" });
      toast.success("Marked as inspected");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function markRepaired() {
    try {
      await changeStatus.mutateAsync({ toStatus: "REPAIRED" });
      toast.success("Marked as repaired");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function markCompleted() {
    try {
      await changeStatus.mutateAsync({ toStatus: "COMPLETED" });
      toast.success("Marked as completed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resolvedLineItems = draftsToLineItems(proposalLineItems);
    try {
      await createProposal.mutateAsync(
        resolvedLineItems.length
          ? { description: proposalForm.description, lineItems: resolvedLineItems }
          : { contractorName: proposalForm.contractorName, costEUR: Number(proposalForm.costEUR), description: proposalForm.description },
      );
      toast.success("Proposal sent for owner approval");
      setProposalOpen(false);
      setProposalForm({ contractorName: "", costEUR: "", description: "" });
      setProposalLineItems([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await createComment.mutateAsync({ body: commentBody });
    setCommentBody("");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category: "MAINTENANCE", maintenanceRequestId: id });
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests", "detail", id] });
      toast.success("Photo attached");
    } catch {
      toast.error("Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handlePhotoDelete(docId: string) {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await deleteDocument.mutateAsync(docId);
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests", "detail", id] });
    } catch {
      toast.error("Could not delete photo");
    }
  }

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-[22px] font-semibold">{request.title}</h1>
          {request.urgent && <StatusChip tone="unpaid">Urgent</StatusChip>}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {request.apartment.name} · Reported {dateFormatter.format(new Date(request.createdAt))}
        </p>
      </div>

      <div className="mb-5 rounded-[14px] border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted-foreground">Status</span>
          <StatusChip tone={request.status === "COMPLETED" ? "done" : request.status === "CANCELLED" ? "unpaid" : "progress"}>
            {STATUS_LABEL[request.status]}
          </StatusChip>
        </div>
        <p className="text-[13.5px]">{request.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {request.status === "REPORTED" && (
            <Button size="sm" onClick={markTriaged} disabled={changeStatus.isPending}>
              Mark as inspected
            </Button>
          )}
          {(request.status === "TRIAGED" || request.status === "PROPOSAL_CREATED") && (
            <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
              <DialogTrigger render={<Button size="sm" />}>Attach repair proposal</DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Repair proposal</DialogTitle>
                </DialogHeader>
                <form onSubmit={submitProposal} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Description</Label>
                    <Textarea
                      required
                      rows={3}
                      value={proposalForm.description}
                      onChange={(e) => setProposalForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <LineItemsEditor
                    items={proposalLineItems}
                    onChange={setProposalLineItems}
                    label="Itemized quote — optional"
                  />
                  {proposalLineItems.length === 0 && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Or: single contractor — Contractor</Label>
                        <Input
                          value={proposalForm.contractorName}
                          onChange={(e) => setProposalForm((f) => ({ ...f, contractorName: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Cost (RON)</Label>
                        <Input
                          type="number"
                          value={proposalForm.costEUR}
                          onChange={(e) => setProposalForm((f) => ({ ...f, costEUR: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        createProposal.isPending ||
                        (proposalLineItems.length === 0 && (!proposalForm.contractorName || !proposalForm.costEUR))
                      }
                    >
                      {createProposal.isPending ? "Sending…" : "Send to owner"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {request.status === "IN_PROGRESS" && (
            <Button size="sm" onClick={markRepaired} disabled={changeStatus.isPending}>
              Mark as repaired
            </Button>
          )}
          {request.status === "REPAIRED" && (
            <Button size="sm" onClick={markCompleted} disabled={changeStatus.isPending}>
              Mark as completed
            </Button>
          )}
          {request.status !== "COMPLETED" && request.status !== "CANCELLED" && <CancelButton id={id} />}
        </div>
      </div>

      {request.proposals && request.proposals.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-[14.5px] font-semibold">Proposals</h3>
          <div className="flex flex-col gap-2">
            {request.proposals.map((p) => (
              <div key={p.id} className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">v{p.version}{p.contractorName ? ` — ${p.contractorName}` : ""}</div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{p.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-tabular font-mono font-semibold">{formatRON(p.costEUR)}</div>
                    <StatusChip tone={p.status === "APPROVED" ? "paid" : p.status === "REJECTED" ? "unpaid" : "open"}>
                      {p.status.toLowerCase()}
                    </StatusChip>
                  </div>
                </div>
                {p.lineItems && p.lineItems.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5">
                    {p.lineItems.map((li) => (
                      <div key={li.id} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-muted-foreground">{li.description}</span>
                        <span className="font-mono-tabular font-mono">{formatRON(li.priceEUR)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <h3 className="mb-3 text-[14.5px] font-semibold">Photos</h3>
        <div className="mb-3 flex flex-col gap-2">
          <Label>Attach a photo — before/after, condition, whatever's useful</Label>
          <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={upload.isPending} />
        </div>
        {request.documents && request.documents.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {request.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => downloadDocument(d.id, d.fileName)}
                  className="flex-1 truncate rounded-md border border-border px-2 py-1.5 text-left text-[12px] hover:border-primary"
                >
                  {d.fileName}
                </button>
                <button
                  type="button"
                  onClick={() => handlePhotoDelete(d.id)}
                  className="rounded-md border border-border px-1.5 py-1 text-[11px] text-destructive"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No photos yet.</p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold">Comments</h3>
        <div className="mb-3 flex flex-col gap-2">
          {comments?.map((c) => (
            <div key={c.id} className="rounded-[12px] border border-border bg-card p-3 text-[13px] shadow-sm">
              {c.body}
              <div className="mt-1 text-xs text-muted-foreground">
                {dateFormatter.format(new Date(c.createdAt))}
                {c.visibleToTenant && " · visible to tenant"}
              </div>
            </div>
          ))}
          {comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        </div>
        <form onSubmit={submitComment} className="flex flex-col gap-2">
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="e.g. Cleaning scheduled for the 14th, paint job still remaining…"
            rows={3}
          />
          <Button type="submit" className="self-end" disabled={createComment.isPending || !commentBody.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function CancelButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useCancelMaintenanceRequest(id);

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cancel.mutateAsync(reason);
      toast.success("Request cancelled");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>Cancel</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCancel} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Reason</Label>
            <Textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
