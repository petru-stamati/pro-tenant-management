"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUtilityRecords, useCreateUtilityRecord } from "@/hooks/use-utility-records";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatRON } from "@/lib/format";

const UTILITY_TYPES = ["ELECTRICITY", "GAS", "COLD_WATER", "HOT_WATER", "HEATING"];

export default function UtilitiesPage() {
  const { data: records, isLoading } = useUtilityRecords();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Utilities</h1>
          <p className="text-[13.5px] text-muted-foreground">{records?.data.length ?? 0} records</p>
        </div>
        <CreateUtilityDialog />
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : records && records.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Consumption</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.apartment?.name ?? "—"}</TableCell>
                  <TableCell>{r.utilityType.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.consumption ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatRON(r.invoiceAmountRON)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(r.invoiceStatus)}>{r.invoiceStatus.toLowerCase()}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No utility records yet.</p>
        )}
      </div>
    </div>
  );
}

function CreateUtilityDialog() {
  const [open, setOpen] = useState(false);
  const { data: apartments } = useApartments();
  const create = useCreateUtilityRecord();
  const [form, setForm] = useState({
    apartmentId: "",
    utilityType: "",
    periodMonth: "",
    previousReading: "",
    currentReading: "",
    invoiceAmountRON: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        apartmentId: form.apartmentId,
        utilityType: form.utilityType,
        periodMonth: form.periodMonth,
        previousReading: form.previousReading ? Number(form.previousReading) : undefined,
        currentReading: form.currentReading ? Number(form.currentReading) : undefined,
        invoiceAmountRON: Number(form.invoiceAmountRON),
      });
      toast.success("Utility record logged");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Log reading</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log utility reading</DialogTitle>
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
            <Label>Utility</Label>
            <Select value={form.utilityType} onValueChange={(v) => setForm((f) => ({ ...f, utilityType: v ?? "" }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a utility type" />
              </SelectTrigger>
              <SelectContent>
                {UTILITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Period (month)</Label>
            <Input
              type="date"
              required
              value={form.periodMonth}
              onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Previous reading</Label>
              <Input
                type="number"
                value={form.previousReading}
                onChange={(e) => setForm((f) => ({ ...f, previousReading: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Current reading</Label>
              <Input
                type="number"
                value={form.currentReading}
                onChange={(e) => setForm((f) => ({ ...f, currentReading: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Invoice amount (RON)</Label>
            <Input
              type="number"
              required
              value={form.invoiceAmountRON}
              onChange={(e) => setForm((f) => ({ ...f, invoiceAmountRON: e.target.value }))}
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.apartmentId || !form.utilityType}>
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
