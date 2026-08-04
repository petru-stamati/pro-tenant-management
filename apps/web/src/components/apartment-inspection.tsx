"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRooms, type RoomItem } from "@/hooks/use-rooms";
import {
  useInspections,
  useStartInspection,
  useRecordInspectionResult,
  useCompleteInspection,
  type InspectionOutcome,
} from "@/hooks/use-inspections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";

const OUTCOME_LABEL: Record<InspectionOutcome, string> = {
  CONFIRMED_GOOD: "Good",
  NEEDS_ATTENTION: "Flagged",
  REPLACED: "Replaced",
  REMOVED: "Removed",
};

const OUTCOME_TONE: Record<InspectionOutcome, "open" | "progress" | "done" | "unpaid"> = {
  CONFIRMED_GOOD: "done",
  NEEDS_ATTENTION: "unpaid",
  REPLACED: "progress",
  REMOVED: "progress",
};

export function InspectButton({ apartmentId }: { apartmentId: string }) {
  const start = useStartInspection(apartmentId);
  const [inspectionId, setInspectionId] = useState<string | null>(null);

  async function handleClick() {
    try {
      const inspection = await start.mutateAsync();
      setInspectionId(inspection.id);
    } catch {
      toast.error("Could not start inspection");
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleClick} disabled={start.isPending}>
        {start.isPending ? "Starting…" : "Inspect apartment"}
      </Button>
      {inspectionId && (
        <InspectionDialog apartmentId={apartmentId} inspectionId={inspectionId} onClose={() => setInspectionId(null)} />
      )}
    </>
  );
}

function InspectionDialog({
  apartmentId,
  inspectionId,
  onClose,
}: {
  apartmentId: string;
  inspectionId: string;
  onClose: () => void;
}) {
  const { data: rooms, isLoading } = useRooms(apartmentId);
  const { data: inspections } = useInspections(apartmentId);
  const complete = useCompleteInspection(apartmentId, inspectionId);
  const [activeItem, setActiveItem] = useState<{ item: RoomItem; outcome: InspectionOutcome } | null>(null);

  const inspection = inspections?.find((i) => i.id === inspectionId);
  const resultByItemId = new Map((inspection?.results ?? []).map((r) => [r.roomItemId, r]));
  const totalItems = rooms?.reduce((sum, r) => sum + r.items.length, 0) ?? 0;

  async function handleComplete() {
    try {
      await complete.mutateAsync(undefined);
      toast.success("Inspection completed — owner notified");
      onClose();
    } catch {
      toast.error("Could not complete inspection");
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inspection</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : totalItems === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inventory items to check yet — add rooms and items in the Inventory section first.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {rooms?.map((room) =>
                room.items.length === 0 ? null : (
                  <div key={room.id}>
                    <div className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">{room.label}</div>
                    <div className="flex flex-col gap-1.5">
                      {room.items.map((item) => {
                        const result = resultByItemId.get(item.id);
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]"
                          >
                            <span>{item.name}</span>
                            {result ? (
                              <StatusChip tone={OUTCOME_TONE[result.outcome]}>{OUTCOME_LABEL[result.outcome]}</StatusChip>
                            ) : (
                              <ItemOutcomeButtons
                                apartmentId={apartmentId}
                                inspectionId={inspectionId}
                                item={item}
                                onNeedsDetail={(outcome) => setActiveItem({ item, outcome })}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Save & finish later
            </Button>
            <Button onClick={handleComplete} disabled={complete.isPending}>
              {complete.isPending ? "Completing…" : "Complete inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {activeItem && (
        <RecordOutcomeDialog
          apartmentId={apartmentId}
          inspectionId={inspectionId}
          item={activeItem.item}
          outcome={activeItem.outcome}
          onClose={() => setActiveItem(null)}
        />
      )}
    </>
  );
}

function ItemOutcomeButtons({
  apartmentId,
  inspectionId,
  item,
  onNeedsDetail,
}: {
  apartmentId: string;
  inspectionId: string;
  item: RoomItem;
  onNeedsDetail: (outcome: InspectionOutcome) => void;
}) {
  const recordResult = useRecordInspectionResult(apartmentId, inspectionId);

  async function markGood() {
    try {
      await recordResult.mutateAsync({ roomItemId: item.id, outcome: "CONFIRMED_GOOD" });
    } catch {
      toast.error("Could not record this item");
    }
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" disabled={recordResult.isPending} onClick={markGood}>
        Good
      </Button>
      <Button size="sm" variant="outline" onClick={() => onNeedsDetail("NEEDS_ATTENTION")}>
        Flag
      </Button>
      <Button size="sm" variant="outline" onClick={() => onNeedsDetail("REPLACED")}>
        Replaced
      </Button>
      <Button size="sm" variant="outline" onClick={() => onNeedsDetail("REMOVED")}>
        Removed
      </Button>
    </div>
  );
}

function RecordOutcomeDialog({
  apartmentId,
  inspectionId,
  item,
  outcome,
  onClose,
}: {
  apartmentId: string;
  inspectionId: string;
  item: RoomItem;
  outcome: InspectionOutcome;
  onClose: () => void;
}) {
  const recordResult = useRecordInspectionResult(apartmentId, inspectionId);
  const [note, setNote] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title =
    outcome === "NEEDS_ATTENTION" ? "Flag item" : outcome === "REPLACED" ? "Mark as replaced" : "Mark as removed";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordResult.mutateAsync({
        roomItemId: item.id,
        outcome,
        note: note.trim() || undefined,
        newName: newName.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {title} — {item.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {outcome === "REPLACED" && (
            <div className="flex flex-col gap-2">
              <Label>New item description</Label>
              <Input required placeholder="e.g. 1 new dishwasher" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>{outcome === "REPLACED" ? "Reason — optional" : "Reason"}</Label>
            <Textarea rows={2} required={outcome !== "REPLACED"} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={recordResult.isPending}>
              {recordResult.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
