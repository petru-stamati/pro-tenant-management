"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUtilityRecords, useCreateUtilityRecord, type UtilityRecord } from "@/hooks/use-utility-records";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useUtilityRates, useUpsertUtilityRate, type UtilityRate } from "@/hooks/use-utility-rates";
import { MeterPicturesDialog } from "@/components/meter-pictures-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusChip, paymentStatusTone } from "@/components/status-chip";
import { ApiError } from "@/lib/api-client";
import { formatRON, dateFormatter } from "@/lib/format";

const UTILITY_TYPES = ["ELECTRICITY", "GAS", "COLD_WATER", "HOT_WATER", "HEATING"];

const UTILITY_UNIT: Record<string, string> = {
  ELECTRICITY: "kWh",
  GAS: "m³",
  COLD_WATER: "m³",
  HOT_WATER: "m³",
  HEATING: "units",
};

export default function UtilitiesPage() {
  const { data: records, isLoading } = useUtilityRecords();
  const [picturesFor, setPicturesFor] = useState<UtilityRecord | null>(null);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Utilities</h1>
          <p className="text-[13.5px] text-muted-foreground">{records?.data.length ?? 0} records</p>
        </div>
        <div className="flex gap-2">
          <UtilityRatesDialog />
          <CreateUtilityDialog />
        </div>
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
                <TableHead>Period</TableHead>
                <TableHead>Last month</TableHead>
                <TableHead>This month</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.apartment?.name ?? "—"}</TableCell>
                  <TableCell>{r.utilityType.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">
                    {dateFormatter.format(new Date(r.periodMonth))}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.previousReading ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">{r.currentReading ?? "—"}</TableCell>
                  <TableCell className="font-mono-tabular font-mono">
                    {r.consumption ?? "—"} {r.consumption ? UTILITY_UNIT[r.utilityType] : ""}
                  </TableCell>
                  <TableCell className="font-mono-tabular font-mono">{formatRON(r.invoiceAmountRON)}</TableCell>
                  <TableCell>
                    <StatusChip tone={paymentStatusTone(r.invoiceStatus)}>{r.invoiceStatus.toLowerCase()}</StatusChip>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setPicturesFor(r)}>
                      See pictures
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No utility records yet.</p>
        )}
      </div>

      {picturesFor && (
        <MeterPicturesDialog record={picturesFor} onClose={() => setPicturesFor(null)} canUpload />
      )}
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
        invoiceAmountRON: form.invoiceAmountRON ? Number(form.invoiceAmountRON) : undefined,
      });
      toast.success("Utility record logged");
      setOpen(false);
      setForm({ apartmentId: "", utilityType: "", periodMonth: "", previousReading: "", currentReading: "", invoiceAmountRON: "" });
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
              <Label>Last month&apos;s reading</Label>
              <Input
                type="number"
                value={form.previousReading}
                onChange={(e) => setForm((f) => ({ ...f, previousReading: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>This month&apos;s reading</Label>
              <Input
                type="number"
                value={form.currentReading}
                onChange={(e) => setForm((f) => ({ ...f, currentReading: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Invoice amount (RON) — optional</Label>
            <Input
              type="number"
              placeholder="Leave blank to auto-calculate from your rate settings"
              value={form.invoiceAmountRON}
              onChange={(e) => setForm((f) => ({ ...f, invoiceAmountRON: e.target.value }))}
            />
            <p className="text-[11.5px] text-muted-foreground">
              With both readings and a configured rate, the amount is calculated automatically.
            </p>
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

function UtilityRatesDialog() {
  const [open, setOpen] = useState(false);
  const { data: owners } = useOwners();
  const [ownerId, setOwnerId] = useState("");
  const { data: rates } = useUtilityRates(ownerId || undefined);
  const upsert = useUpsertUtilityRate();

  const rateFor = (type: string) => rates?.find((r) => r.utilityType === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Utility rates</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Utility rates</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? "")}>
              <SelectTrigger>
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

          {ownerId && (
            <Tabs defaultValue="ELECTRICITY">
              <TabsList>
                <TabsTrigger value="ELECTRICITY">Electricity</TabsTrigger>
                <TabsTrigger value="GAS">Gas</TabsTrigger>
                <TabsTrigger value="COLD_WATER">Water</TabsTrigger>
              </TabsList>
              <TabsContent value="ELECTRICITY">
                <ElectricityRateForm ownerId={ownerId} rate={rateFor("ELECTRICITY")} onSave={upsert.mutateAsync} />
              </TabsContent>
              <TabsContent value="GAS">
                <GasRateForm ownerId={ownerId} rate={rateFor("GAS")} onSave={upsert.mutateAsync} />
              </TabsContent>
              <TabsContent value="COLD_WATER">
                <WaterRateForm ownerId={ownerId} rate={rateFor("COLD_WATER")} onSave={upsert.mutateAsync} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SaveRateFn = (input: {
  ownerId: string;
  utilityType: string;
  pricePerUnit: number;
  conversionFactor?: number;
  vatPercent?: number;
  maintenanceFee?: number;
  maintenanceVatPercent?: number;
}) => Promise<unknown>;

function ElectricityRateForm({ ownerId, rate, onSave }: { ownerId: string; rate?: UtilityRate; onSave: SaveRateFn }) {
  const [price, setPrice] = useState(rate?.pricePerUnit ?? "1.57");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ ownerId, utilityType: "ELECTRICITY", pricePerUnit: Number(price) });
      toast.success("Electricity rate saved");
    } catch {
      toast.error("Could not save rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex flex-col gap-2">
        <Label>Price per kWh (RON, VAT incl.)</Label>
        <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <p className="text-[11.5px] text-muted-foreground">Amount = usage (kWh) × price</p>
      <Button size="sm" onClick={save} disabled={saving} className="self-start">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function GasRateForm({ ownerId, rate, onSave }: { ownerId: string; rate?: UtilityRate; onSave: SaveRateFn }) {
  const [price, setPrice] = useState(rate?.pricePerUnit ?? "0.24");
  const [factor, setFactor] = useState(rate?.conversionFactor ?? "10.79");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ ownerId, utilityType: "GAS", pricePerUnit: Number(price), conversionFactor: Number(factor) });
      toast.success("Gas rate saved");
    } catch {
      toast.error("Could not save rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>m³ → kWh factor</Label>
          <Input type="number" step="0.01" value={factor} onChange={(e) => setFactor(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Price per kWh (RON)</Label>
          <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground">Amount = usage (m³) × factor × price</p>
      <Button size="sm" onClick={save} disabled={saving} className="self-start">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function WaterRateForm({ ownerId, rate, onSave }: { ownerId: string; rate?: UtilityRate; onSave: SaveRateFn }) {
  const [price, setPrice] = useState(rate?.pricePerUnit ?? "6.3");
  const [vat, setVat] = useState(rate?.vatPercent ?? "11");
  const [fee, setFee] = useState(rate?.maintenanceFee ?? "4.95");
  const [feeVat, setFeeVat] = useState(rate?.maintenanceVatPercent ?? "21");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        ownerId,
        utilityType: "COLD_WATER",
        pricePerUnit: Number(price),
        vatPercent: Number(vat),
        maintenanceFee: Number(fee),
        maintenanceVatPercent: Number(feeVat),
      });
      toast.success("Water rate saved");
    } catch {
      toast.error("Could not save rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Price per m³ (RON)</Label>
          <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>VAT (%)</Label>
          <Input type="number" step="0.1" value={vat} onChange={(e) => setVat(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Maintenance fee (RON)</Label>
          <Input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Maintenance VAT (%)</Label>
          <Input type="number" step="0.1" value={feeVat} onChange={(e) => setFeeVat(e.target.value)} />
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        Amount = (usage (m³) × price × (1 + VAT)) + (maintenance fee × (1 + maintenance VAT))
      </p>
      <Button size="sm" onClick={save} disabled={saving} className="self-start">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

