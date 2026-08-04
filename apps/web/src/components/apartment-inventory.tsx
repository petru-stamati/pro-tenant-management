"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useCreateRoomItem,
  useDeleteRoomItem,
  type Room,
  type RoomItem,
  type RoomType,
} from "@/hooks/use-rooms";
import { useCreateMaintenanceRequest } from "@/hooks/use-maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  BEDROOM: "Bedroom",
  BATHROOM: "Bathroom",
  KITCHEN: "Kitchen",
  HALLWAY: "Hallway",
  LIVING_ROOM: "Living room",
  OTHER: "Other",
};

export function ApartmentInventory({ apartmentId, canEdit }: { apartmentId: string; canEdit: boolean }) {
  const { data: rooms, isLoading } = useRooms(apartmentId);
  const [addRoomOpen, setAddRoomOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setAddRoomOpen(true)}>
            + Add room
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rooms && rooms.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard key={room.id} apartmentId={apartmentId} room={room} canEdit={canEdit} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          No rooms set up yet.
        </div>
      )}

      {addRoomOpen && <AddRoomDialog apartmentId={apartmentId} onClose={() => setAddRoomOpen(false)} />}
    </div>
  );
}

function RoomCard({ apartmentId, room, canEdit }: { apartmentId: string; room: Room; canEdit: boolean }) {
  const updateRoom = useUpdateRoom(apartmentId);
  const deleteRoom = useDeleteRoom(apartmentId);
  const createItem = useCreateRoomItem(apartmentId);
  const deleteItem = useDeleteRoomItem(apartmentId);
  const [newItemName, setNewItemName] = useState("");
  const [reportFor, setReportFor] = useState<RoomItem | null>(null);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      await createItem.mutateAsync({ roomId: room.id, name: newItemName.trim() });
      setNewItemName("");
    } catch {
      toast.error("Could not add item");
    }
  }

  async function handleDeleteRoom() {
    try {
      await deleteRoom.mutateAsync(room.id);
      toast.success("Room removed");
    } catch {
      toast.error("Could not remove room");
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {ROOM_TYPE_LABEL[room.type]}
          </div>
          <div className="text-[14.5px] font-semibold">{room.label}</div>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={handleDeleteRoom} disabled={deleteRoom.isPending}>
            Remove
          </Button>
        )}
      </div>

      {canEdit ? (
        <label className="mb-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <input
            type="checkbox"
            checked={room.notFurnished}
            onChange={(e) => updateRoom.mutate({ id: room.id, notFurnished: e.target.checked })}
          />
          Not furnished
        </label>
      ) : (
        room.notFurnished && (
          <p className="mb-3 text-[12.5px] text-muted-foreground">Not furnished</p>
        )
      )}

      <div className="flex flex-col gap-1.5">
        {room.items.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No items listed.</p>
        ) : (
          room.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{item.name}</span>
                {item.condition === "NEEDS_ATTENTION" && (
                  <StatusChip tone="unpaid">{item.conditionNote || "needs attention"}</StatusChip>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title="Report a problem"
                  onClick={() => setReportFor(item)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50"
                >
                  ⚠
                </button>
                {canEdit && (
                  <button
                    type="button"
                    title="Remove item"
                    onClick={() => deleteItem.mutate(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <form onSubmit={handleAddItem} className="mt-2 flex gap-2">
          <Input
            className="h-8"
            placeholder="Add item…"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={!newItemName.trim() || createItem.isPending}>
            Add
          </Button>
        </form>
      )}

      {reportFor && (
        <ReportItemProblemDialog apartmentId={apartmentId} item={reportFor} onClose={() => setReportFor(null)} />
      )}
    </div>
  );
}

function AddRoomDialog({ apartmentId, onClose }: { apartmentId: string; onClose: () => void }) {
  const createRoom = useCreateRoom();
  const [type, setType] = useState<RoomType>("BEDROOM");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRoom.mutateAsync({ apartmentId, type, label: label.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType((v as RoomType) ?? "BEDROOM")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_TYPE_LABEL).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Label</Label>
            <Input
              required
              placeholder="e.g. Bedroom 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={createRoom.isPending || !label.trim()}>
              {createRoom.isPending ? "Adding…" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportItemProblemDialog({
  apartmentId,
  item,
  onClose,
}: {
  apartmentId: string;
  item: RoomItem;
  onClose: () => void;
}) {
  const create = useCreateMaintenanceRequest();
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        apartmentId,
        roomItemId: item.id,
        title: `Problem with ${item.name}`,
        description: description.trim() || `Reported a problem with ${item.name}.`,
        urgent,
      });
      toast.success("Maintenance request created");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Report a problem — {item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label>What's wrong — optional</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            Mark as urgent
          </label>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Report problem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
