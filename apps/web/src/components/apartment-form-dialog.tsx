"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOwners } from "@/hooks/use-owners";
import { useCreateApartment, useUpdateApartment, type ApartmentDetail } from "@/hooks/use-apartments";
import { ApiError } from "@/lib/api-client";

export function ApartmentFormDialog({
  apartment,
  trigger,
}: {
  apartment?: ApartmentDetail;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: owners } = useOwners();
  const create = useCreateApartment();
  const update = useUpdateApartment(apartment?.id ?? "");
  const isEdit = !!apartment;

  const [form, setForm] = useState({
    ownerId: apartment?.ownerId ?? "",
    name: apartment?.name ?? "",
    addressLine: apartment?.addressLine ?? "",
    city: apartment?.city ?? "",
    sector: apartment?.sector ?? "",
    status: apartment?.status ?? "VACANT",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await update.mutateAsync(form);
        toast.success("Apartment updated");
      } else {
        await create.mutateAsync(form);
        toast.success("Apartment created");
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit apartment" : "Add apartment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerId">Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v ?? "" }))}>
              <SelectTrigger id="ownerId">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Drumul Taberei 41, Ap. 12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine">Address</Label>
            <Input
              id="addressLine"
              required
              value={form.addressLine}
              onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                required
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sector">Sector</Label>
              <Input
                id="sector"
                value={form.sector}
                onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                placeholder="Sector 6"
              />
            </div>
          </div>
          {apartment?.status === "OCCUPIED" ? (
            <p className="text-[11.5px] text-muted-foreground">
              This unit is occupied — status is driven by its lease, not editable here.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: (v as typeof form.status) ?? "VACANT" }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACANT">Vacant</SelectItem>
                  <SelectItem value="UNDER_MAINTENANCE">Under maintenance (not showable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !form.ownerId}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create apartment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
