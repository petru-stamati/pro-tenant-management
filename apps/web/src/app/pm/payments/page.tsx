"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRentPayments, useCreateRentPayment, useRecordPayment, useGenerateInvoice } from "@/hooks/use-rent-payments";
import { useLeases } from "@/hooks/use-leases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatEUR, dateFormatter } from "@/lib/format";

export default function PaymentsPage() {
  const { data: payments, isLoading } = useRentPayments();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Rent Payments</h1>
          <p className="text-[13.5px] text-muted-foreground">{payments?.data.length ?? 0} ledger entries</p>
        </div>
        <CreatePaymentDialog />
      </div>

      <div className="rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : payments && payments.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apartment</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.apartment?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(p.dueDate))}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(p.rentAmountEUR)}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatEUR(p.paidAmountEUR)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(p.status)}>{p.status.replace("_", " ").toLowerCase()}</StatusChip>
                  </TableCell>
                  <TableCell className="text-right">
                    <PaymentActions payment={p} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No rent payments recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function PaymentActions({ payment }: { payment: { id: string; status: string; invoice?: { id: string } | null } }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const recordPayment = useRecordPayment(payment.id);
  const generateInvoice = useGenerateInvoice(payment.id);

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    try {
      await recordPayment.mutateAsync({ paidAmountEUR: Number(amount) });
      toast.success("Payment recorded");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleGenerateInvoice() {
    try {
      await generateInvoice.mutateAsync();
      toast.success("Invoice generated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Record payment</DialogTrigger>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecord} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Amount paid (EUR)</Label>
              <Input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {!payment.invoice && payment.status !== "UNPAID" && (
        <Button size="sm" variant="outline" onClick={handleGenerateInvoice} disabled={generateInvoice.isPending}>
          Generate invoice
        </Button>
      )}
    </div>
  );
}

function CreatePaymentDialog() {
  const [open, setOpen] = useState(false);
  const { data: leases } = useLeases({ status: "ACTIVE" });
  const create = useCreateRentPayment();
  const [form, setForm] = useState({ leaseId: "", dueDate: "", rentAmountEUR: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ ...form, rentAmountEUR: Number(form.rentAmountEUR) });
      toast.success("Rent payment ledger row created");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New ledger row</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New rent payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Lease</Label>
            <Select value={form.leaseId} onValueChange={(v) => setForm((f) => ({ ...f, leaseId: v ?? "" }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select an active lease" />
              </SelectTrigger>
              <SelectContent>
                {leases?.data.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.apartment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Due date</Label>
            <Input
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rent (EUR)</Label>
            <Input
              type="number"
              required
              value={form.rentAmountEUR}
              onChange={(e) => setForm((f) => ({ ...f, rentAmountEUR: e.target.value }))}
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.leaseId}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
