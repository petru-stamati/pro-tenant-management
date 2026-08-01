"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useUtilityRecords,
  useCreateUtilityRecord,
  useLastUtilityRecord,
  TRACKED_UTILITY_TYPES,
  type UtilityRecord,
  type TrackedUtilityType,
} from "@/hooks/use-utility-records";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useUtilityRates, useUpsertUtilityRate, type UtilityRate } from "@/hooks/use-utility-rates";
import { MeterPicturesDialog } from "@/components/meter-pictures-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { formatRON } from "@/lib/format";

const UTILITY_LABEL: Record<TrackedUtilityType, string> = {
  ELECTRICITY: "Electricity",
  GAS: "Gas",
  COLD_WATER: "Water",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function UtilitiesPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: owners } = useOwners();
  const { data: records, isLoading: recordsLoading } = useUtilityRecords({ month });
  const [activeCell, setActiveCell] = useState<{ apartmentId: string; apartmentName: string; utilityType: TrackedUtilityType } | null>(null);
  const [picturesFor, setPicturesFor] = useState<UtilityRecord | null>(null);

  const recordLookup = useMemo(() => {
    const map = new Map<string, UtilityRecord>();
    records?.data.forEach((r) => map.set(`${r.apartment?.id}:${r.utilityType}`, r));
    return map;
  }, [records]);

  const ownerName = (ownerId: string | undefined) => owners?.data.find((o) => o.id === ownerId)?.companyName ?? "—";

  const isLoading = apartmentsLoading || recordsLoading;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold">Utilities</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {apartments?.data.length ?? 0} apartments · amounts shown are VAT incl.
          </p>
        </div>
        <UtilityRatesDialog />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ← Prev
        </Button>
        <div className="min-w-[160px] text-center text-[15px] font-semibold">{monthLabel(month)}</div>
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          Next →
        </Button>
        {month !== currentMonth() && (
          <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>
            Today
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-sm">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : apartments && apartments.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Apartment</th>
                {TRACKED_UTILITY_TYPES.map((t) => (
                  <th key={t} className="p-3 font-medium text-muted-foreground">
                    {UTILITY_LABEL[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apartments.data.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{ownerName(a.ownerId)}</div>
                  </td>
                  {TRACKED_UTILITY_TYPES.map((t) => {
                    const record = recordLookup.get(`${a.id}:${t}`);
                    return (
                      <td key={t} className="p-3">
                        {record ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPicturesFor(record)}
                              className="rounded-md px-2 py-1 font-mono-tabular font-mono text-[13.5px] hover:bg-accent/60"
                              title="See pictures"
                            >
                              {formatRON(record.invoiceAmountRON)}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveCell({ apartmentId: a.id, apartmentName: a.name, utilityType: t })}
                            className="rounded-md border border-dashed border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            + Add
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No apartments yet.</p>
        )}
      </div>

      {activeCell && (
        <LogReadingDialog
          apartmentId={activeCell.apartmentId}
          apartmentName={activeCell.apartmentName}
          utilityType={activeCell.utilityType}
          periodMonth={month}
          onClose={() => setActiveCell(null)}
        />
      )}

      {picturesFor && <MeterPicturesDialog record={picturesFor} onClose={() => setPicturesFor(null)} canUpload />}
    </div>
  );
}

function LogReadingDialog({
  apartmentId,
  apartmentName,
  utilityType,
  periodMonth,
  onClose,
}: {
  apartmentId: string;
  apartmentName: string;
  utilityType: TrackedUtilityType;
  periodMonth: string;
  onClose: () => void;
}) {
  const { data: last, isLoading: lastLoading } = useLastUtilityRecord(apartmentId, utilityType);
  const create = useCreateUtilityRecord();
  const carriedReading = last?.data[0]?.currentReading ?? null;
  const [manualPrevious, setManualPrevious] = useState("");
  const [currentReading, setCurrentReading] = useState("");
  const [invoiceAmountRON, setInvoiceAmountRON] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const previousReading = carriedReading !== null ? Number(carriedReading) : Number(manualPrevious);
    try {
      await create.mutateAsync({
        apartmentId,
        utilityType,
        periodMonth: `${periodMonth}-01`,
        previousReading,
        currentReading: Number(currentReading),
        invoiceAmountRON: invoiceAmountRON ? Number(invoiceAmountRON) : undefined,
      });
      toast.success("Reading logged");
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
            {apartmentName} — {UTILITY_LABEL[utilityType]}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Last month&apos;s reading</Label>
            {lastLoading ? (
              <p className="text-[13px] text-muted-foreground">Checking…</p>
            ) : carriedReading !== null ? (
              <p className="rounded-md bg-accent/40 px-3 py-2 font-mono-tabular font-mono text-[14px]">
                {carriedReading} <span className="text-[11.5px] text-muted-foreground">(carried forward automatically)</span>
              </p>
            ) : (
              <>
                <Input
                  type="number"
                  required
                  placeholder="No prior reading on file — enter the starting number"
                  value={manualPrevious}
                  onChange={(e) => setManualPrevious(e.target.value)}
                />
                <p className="text-[11.5px] text-muted-foreground">
                  First reading for this apartment/utility — every month after this one will carry forward automatically.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>This month&apos;s reading</Label>
            <Input type="number" required value={currentReading} onChange={(e) => setCurrentReading(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Invoice amount (RON) — optional</Label>
            <Input
              type="number"
              placeholder="Leave blank to auto-calculate from your rate settings"
              value={invoiceAmountRON}
              onChange={(e) => setInvoiceAmountRON(e.target.value)}
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !currentReading || (carriedReading === null && !manualPrevious)}>
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
