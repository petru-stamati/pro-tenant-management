"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRON } from "@/lib/format";

export interface LineItemDraft {
  description: string;
  priceEUR: string;
}

/** Dynamic "description + price" rows used both when reporting a PM-quoted repair task and when revising a quote. */
export function LineItemsEditor({
  items,
  onChange,
  label = "Repairs / services — optional",
}: {
  items: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
  label?: string;
}) {
  const total = items.reduce((sum, i) => sum + Number(i.priceEUR || 0), 0);

  function update(index: number, patch: Partial<LineItemDraft>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { description: "", priceEUR: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="e.g. Repaint living room"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            step="0.01"
            placeholder="RON"
            value={item.priceEUR}
            onChange={(e) => update(i, { priceEUR: e.target.value })}
            className="w-24"
          />
          <button type="button" onClick={() => remove(i)} className="px-1 text-[15px] text-destructive" title="Remove">
            ×
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="self-start">
        + Add item
      </Button>
      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-accent/40 px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono-tabular font-mono font-semibold">{formatRON(total)}</span>
        </div>
      )}
    </div>
  );
}

export function draftsToLineItems(items: LineItemDraft[]) {
  return items
    .filter((i) => i.description.trim() && i.priceEUR !== "")
    .map((i) => ({ description: i.description.trim(), priceEUR: Number(i.priceEUR) }));
}
