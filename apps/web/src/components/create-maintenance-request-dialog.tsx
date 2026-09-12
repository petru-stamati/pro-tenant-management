"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateMaintenanceRequest } from "@/hooks/use-maintenance";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineItemsEditor, draftsToLineItems, type LineItemDraft } from "@/components/line-items-editor";
import { ApiError } from "@/lib/api-client";

/**
 * Reused both as the standalone "+ Report issue" button on the Maintenance
 * list and as the "create a task from what this inspection flagged" action
 * on the apartment Inspection flow — same form either way, just pre-filled
 * differently and with the apartment locked when it's already known.
 */
export function CreateMaintenanceRequestDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  apartmentId: fixedApartmentId,
  initialTitle = "",
  initialDescription = "",
  initialLineItems = [],
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  apartmentId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialLineItems?: LineItemDraft[];
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { data: apartments } = useApartments();
  const create = useCreateMaintenanceRequest();
  const [form, setForm] = useState({
    apartmentId: fixedApartmentId ?? "",
    title: initialTitle,
    description: initialDescription,
    urgent: false,
  });
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(initialLineItems);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const resolvedLineItems = draftsToLineItems(lineItems);
      await create.mutateAsync({ ...form, lineItems: resolvedLineItems.length ? resolvedLineItems : undefined });
      toast.success("Maintenance request created");
      setOpen(false);
      setForm({ apartmentId: fixedApartmentId ?? "", title: "", description: "", urgent: false });
      setLineItems([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fixedApartmentId ? "Create maintenance task" : "Report an issue"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!fixedApartmentId && (
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
          )}
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
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <LineItemsEditor items={lineItems} onChange={setLineItems} />
          {lineItems.length > 0 && (
            <p className="text-[11.5px] text-muted-foreground">
              Adding items sends this straight to the Owner for approval — skipping the usual inspect/triage step,
              since you've already assessed and quoted it yourself.
            </p>
          )}
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
