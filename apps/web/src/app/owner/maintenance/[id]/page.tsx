"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  useMaintenanceRequest,
  useMaintenanceComments,
  useDecideProposal,
  useCreateComment,
} from "@/hooks/use-maintenance";
import { downloadDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatEUR, dateFormatter } from "@/lib/format";

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

export default function OwnerMaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(id);
  const { data: comments } = useMaintenanceComments(id);
  const createComment = useCreateComment(id);
  const [commentBody, setCommentBody] = useState("");

  if (isLoading || !request) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pendingProposal = request.proposals?.find((p) => p.status === "PENDING");

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await createComment.mutateAsync({ body: commentBody });
    setCommentBody("");
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
      </div>

      {pendingProposal && (
        <div className="mb-5 rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-[14.5px] font-semibold">Repair quote — awaiting your decision</h3>
          <div className="mb-3">
            {pendingProposal.contractorName && <div className="font-medium">{pendingProposal.contractorName}</div>}
            <p className="mt-0.5 text-[13px] text-muted-foreground">{pendingProposal.description}</p>
            {pendingProposal.lineItems && pendingProposal.lineItems.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                {pendingProposal.lineItems.map((li) => (
                  <div key={li.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{li.description}</span>
                    <span className="font-mono-tabular font-mono">{formatEUR(li.priceEUR)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="text-[13px] text-muted-foreground">Total</span>
              <div className="font-mono-tabular font-mono text-lg font-semibold">
                {formatEUR(pendingProposal.costEUR)}
              </div>
            </div>
          </div>
          <ProposalDecision requestId={id} proposalId={pendingProposal.id} />
        </div>
      )}

      {request.documents && request.documents.length > 0 && (
        <div className="mb-5 rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-[14.5px] font-semibold">Photos</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {request.documents.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => downloadDocument(d.id, d.fileName)}
                className="truncate rounded-md border border-border px-2 py-1.5 text-left text-[12px] hover:border-primary"
              >
                {d.fileName}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.proposals && request.proposals.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-3 text-[14.5px] font-semibold">Proposal history</h3>
          <div className="flex flex-col gap-2">
            {request.proposals.map((p) => (
              <div key={p.id} className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">v{p.version}{p.contractorName ? ` — ${p.contractorName}` : ""}</div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{p.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-tabular font-mono font-semibold">{formatEUR(p.costEUR)}</div>
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
                        <span className="font-mono-tabular font-mono">{formatEUR(li.priceEUR)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold">Comments</h3>
        <div className="mb-3 flex flex-col gap-2">
          {comments?.map((c) => (
            <div key={c.id} className="rounded-[12px] border border-border bg-card p-3 text-[13px] shadow-sm">
              {c.body}
              <div className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(c.createdAt))}</div>
            </div>
          ))}
          {comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        </div>
        <form onSubmit={submitComment} className="flex flex-col gap-2">
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
          />
          <Button type="submit" disabled={createComment.isPending || !commentBody.trim()} className="self-end">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProposalDecision({ requestId, proposalId }: { requestId: string; proposalId: string }) {
  const decide = useDecideProposal(requestId, proposalId);
  const [comment, setComment] = useState("");

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    try {
      await decide.mutateAsync({ decision, comment: comment.trim() || undefined });
      toast.success(decision === "APPROVED" ? "Proposal approved" : "Proposal rejected");
      setComment("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)…"
        rows={2}
      />
      <div className="flex gap-2">
        <Button onClick={() => handleDecision("APPROVED")} disabled={decide.isPending}>
          Approve
        </Button>
        <Button variant="destructive" onClick={() => handleDecision("REJECTED")} disabled={decide.isPending}>
          Reject
        </Button>
      </div>
    </div>
  );
}
