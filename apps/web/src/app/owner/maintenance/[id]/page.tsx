"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  useMaintenanceRequest,
  useMaintenanceComments,
  useDecideProposal,
  useCreateComment,
  type MaintenanceStatus,
} from "@/hooks/use-maintenance";
import { downloadDocument } from "@/hooks/use-documents";
import { useDocumentBlobUrl } from "@/hooks/use-document-blob-url";
import { useLatestExchangeRate } from "@/hooks/use-exchange-rate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/status-chip";
import { Slash } from "@/components/ui/slash";
import { ApiError } from "@/lib/api-client";
import { formatRON, formatEUR, dateFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

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

// Amounts on maintenance quotes are RON — the PM types repair/cleaning
// prices directly in RON (all apartments are in Romania). The `priceEUR` /
// `costEUR` field names are legacy from an earlier EUR-only version and
// were kept to avoid a data migration; only the display layer changed.
// The ≈EUR figures shown alongside them are a reference conversion at
// today's BNR rate, not the source of truth.
const STEPS: MaintenanceStatus[] = ["REPORTED", "TRIAGED", "PROPOSAL_CREATED", "PENDING_OWNER_APPROVAL", "IN_PROGRESS", "REPAIRED", "COMPLETED"];

function Stepper({ status }: { status: MaintenanceStatus }) {
  if (status === "CANCELLED") return <StatusChip tone="unpaid">Cancelled</StatusChip>;
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex shrink-0 items-center gap-1.5">
          {i > 0 && <Slash width={3} height={10} className={i <= currentIndex ? "bg-primary" : "bg-border"} />}
          <span
            className={cn(
              "text-[11.5px] font-medium whitespace-nowrap",
              i < currentIndex ? "text-primary" : i === currentIndex ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {i < currentIndex && "✓ "}
            {STATUS_LABEL[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhotoThumb({ documentId, fileName }: { documentId: string; fileName: string }) {
  const { url, failed } = useDocumentBlobUrl(documentId);
  return (
    <button
      type="button"
      onClick={() => downloadDocument(documentId, fileName)}
      className="relative aspect-square overflow-hidden rounded-[10px] border border-border bg-muted"
      title={fileName}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
          {failed ? "No preview" : "…"}
        </span>
      )}
    </button>
  );
}

export default function OwnerMaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(id);
  const { data: comments } = useMaintenanceComments(id);
  const { data: exchangeRate } = useLatestExchangeRate();
  const createComment = useCreateComment(id);
  const [commentBody, setCommentBody] = useState("");

  if (isLoading || !request) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pendingProposal = request.proposals?.find((p) => p.status === "PENDING");
  const previousProposal = pendingProposal
    ? request.proposals?.find((p) => p.version === pendingProposal.version - 1)
    : undefined;
  const savingRON = previousProposal && pendingProposal ? Number(previousProposal.costEUR) - Number(pendingProposal.costEUR) : 0;

  const eurFor = (ron: string | number) => (exchangeRate ? formatEUR(Number(ron) / Number(exchangeRate.rateRON)) : null);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await createComment.mutateAsync({ body: commentBody });
    setCommentBody("");
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <p className="mb-1 text-[12px] text-muted-foreground">
        Maintenance / {request.apartment.name} / {request.title}
      </p>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="font-heading text-[22px] font-semibold">{request.title}</h1>
        {request.urgent && <StatusChip tone="unpaid">Urgent</StatusChip>}
      </div>
      <p className="mb-3 text-[13px] text-muted-foreground">
        {request.apartment.name} · Reported {dateFormatter.format(new Date(request.createdAt))}
      </p>
      <div className="mb-6 rounded-[14px] border border-border bg-card px-4 py-3 shadow-sm">
        <Stepper status={request.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-2 font-heading text-[16px] font-semibold">Tenant&rsquo;s report</h3>
            <p className="text-[13.5px]">{request.description}</p>
            {request.documents && request.documents.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {request.documents.slice(0, 8).map((d) => (
                  <PhotoThumb key={d.id} documentId={d.id} fileName={d.fileName} />
                ))}
              </div>
            )}
          </div>

          {pendingProposal && (
            <div className="rounded-[16px] border border-primary/25 bg-card p-5 shadow-sm">
              <h3 className="mb-3 font-heading text-[16px] font-semibold">Current quote — v{pendingProposal.version}</h3>
              {pendingProposal.contractorName && <div className="mb-1 font-medium">{pendingProposal.contractorName}</div>}
              <p className="mb-3 text-[13px] text-muted-foreground">{pendingProposal.description}</p>
              {pendingProposal.lineItems && pendingProposal.lineItems.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-divider pt-3">
                  {pendingProposal.lineItems.map((li) => (
                    <div key={li.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">{li.description}</span>
                      <span className="font-mono-tabular font-mono">{formatRON(li.priceEUR)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t-[1.5px] border-foreground pt-2">
                <span className="text-[13px] text-muted-foreground">Total</span>
                <div className="font-mono-tabular font-mono text-lg font-semibold">{formatRON(pendingProposal.costEUR)}</div>
              </div>
              {previousProposal && (
                <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span className="line-through">v{previousProposal.version}: {formatRON(previousProposal.costEUR)}</span>
                  {savingRON !== 0 && (
                    <span className={savingRON > 0 ? "font-medium text-primary" : "font-medium text-destructive"}>
                      {savingRON > 0 ? `Saves ${formatRON(savingRON)}` : `+${formatRON(Math.abs(savingRON))}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-heading text-[16px] font-semibold">Discussion</h3>
            <div className="mb-3 flex flex-col gap-2.5">
              {comments?.map((c) => (
                <div key={c.id} className="rounded-[12px] bg-accent/30 p-3 text-[13px]">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                      {c.author ? `${c.author.firstName[0]}${c.author.lastName[0]}` : "—"}
                    </span>
                    <span className="font-medium">{c.author ? `${c.author.firstName} ${c.author.lastName}` : "—"}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{dateFormatter.format(new Date(c.createdAt))}</span>
                  </div>
                  {c.body}
                </div>
              ))}
              {comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            </div>
            <form onSubmit={submitComment} className="flex flex-col gap-2">
              <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment…" rows={3} />
              <Button type="submit" disabled={createComment.isPending || !commentBody.trim()} className="self-end">
                Send
              </Button>
            </form>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {pendingProposal ? (
            <div className="rounded-[16px] border border-border bg-card p-5 shadow-[0_12px_32px_rgba(20,23,15,.07)]">
              <div className="font-mono-tabular font-mono text-[34px] font-semibold tracking-[-0.8px]">
                {formatRON(pendingProposal.costEUR)}
              </div>
              {eurFor(pendingProposal.costEUR) && (
                <div className="mb-4 text-[12.5px] text-muted-foreground">≈{eurFor(pendingProposal.costEUR)}</div>
              )}
              <ProposalDecision requestId={id} proposalId={pendingProposal.id} />
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Approving notifies the PM and moves this to In progress. Rejecting sends it back for a revised quote.
              </p>
            </div>
          ) : (
            <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
              <span className="text-[13px] font-medium">Status</span>
              <div className="mt-2">
                <StatusChip tone={request.status === "COMPLETED" ? "done" : request.status === "CANCELLED" ? "unpaid" : "progress"}>
                  {STATUS_LABEL[request.status]}
                </StatusChip>
              </div>
              {request.status === "COMPLETED" && (
                <p className="mt-2 text-[12.5px] text-muted-foreground">This repair is complete — the apartment is ready.</p>
              )}
            </div>
          )}

          {request.proposals && request.proposals.length > 1 && (
            <div className="mt-4 rounded-[16px] border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-3 font-heading text-[14px] font-semibold">Proposal history</h3>
              <div className="flex flex-col gap-2">
                {[...request.proposals].reverse().map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-muted-foreground">
                      v{p.version}
                      {p.contractorName ? ` — ${p.contractorName}` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-mono">{formatRON(p.costEUR)}</span>
                      <StatusChip tone={p.status === "APPROVED" ? "paid" : p.status === "REJECTED" ? "unpaid" : "open"}>
                        {p.status.toLowerCase()}
                      </StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note (optional)…" rows={2} />
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => handleDecision("APPROVED")} disabled={decide.isPending}>
          Approve
        </Button>
        <Button variant="destructive" className="flex-1" onClick={() => handleDecision("REJECTED")} disabled={decide.isPending}>
          Reject
        </Button>
      </div>
    </div>
  );
}
