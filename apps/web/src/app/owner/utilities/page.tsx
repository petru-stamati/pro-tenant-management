"use client";

import { useMemo, useState } from "react";
import {
  useUtilityRecords,
  TRACKED_UTILITY_TYPES,
  type UtilityRecord,
  type TrackedUtilityType,
} from "@/hooks/use-utility-records";
import { useApartments } from "@/hooks/use-apartments";
import { MeterPicturesDialog } from "@/components/meter-pictures-dialog";
import { Button } from "@/components/ui/button";
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

export default function OwnerUtilitiesPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: apartments, isLoading: apartmentsLoading } = useApartments();
  const { data: records, isLoading: recordsLoading } = useUtilityRecords({ month });
  const [picturesFor, setPicturesFor] = useState<UtilityRecord | null>(null);

  const recordLookup = useMemo(() => {
    const map = new Map<string, UtilityRecord>();
    records?.data.forEach((r) => map.set(`${r.apartment?.id}:${r.utilityType}`, r));
    return map;
  }, [records]);

  const isLoading = apartmentsLoading || recordsLoading;

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <h1 className="text-[23px] font-semibold">Utilities</h1>
        <p className="text-[13.5px] text-muted-foreground">{apartments?.data.length ?? 0} apartments</p>
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
                  <td className="p-3 font-medium">{a.name}</td>
                  {TRACKED_UTILITY_TYPES.map((t) => {
                    const record = recordLookup.get(`${a.id}:${t}`);
                    return (
                      <td key={t} className="p-3">
                        {record ? (
                          <button
                            onClick={() => setPicturesFor(record)}
                            className="rounded-md px-2 py-1 font-mono-tabular font-mono text-[13.5px] hover:bg-accent/60"
                            title="See pictures"
                          >
                            {formatRON(record.invoiceAmountRON)}
                          </button>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground">—</span>
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

      {picturesFor && <MeterPicturesDialog record={picturesFor} onClose={() => setPicturesFor(null)} />}
    </div>
  );
}
