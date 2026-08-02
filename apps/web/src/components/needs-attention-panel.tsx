"use client";

import Link from "next/link";
import { useOpenItems } from "@/hooks/use-open-items";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/status-chip";

const PREVIEW_LIMIT = 5;

/** Dashboard reminder of what's still open in the Tasks tab — same merged Task+Maintenance list, capped and linked out. */
export function NeedsAttentionPanel({ role }: { role: "PM" | "OWNER" }) {
  const { openItems, isLoading } = useOpenItems(role);
  const preview = openItems.slice(0, PREVIEW_LIMIT);
  const base = role === "PM" ? "/pm" : "/owner";

  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-[14.5px] font-semibold">Needs your attention</h3>
        {openItems.length > 0 && (
          <Link href={`${base}/tasks`} className="text-[12.5px] font-medium text-primary hover:underline">
            View all {openItems.length} →
          </Link>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : preview.length > 0 ? (
        <div className="flex flex-col divide-y divide-border">
          {preview.map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              href={item.href}
              className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-2.5 text-[13px] hover:bg-accent/30"
            >
              <div className="flex min-w-0 items-center gap-2">
                {item.urgent && (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    Urgent
                  </Badge>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {item.apartmentName ?? "General"} · Waiting on {item.waitingOn ?? "—"}
                  </div>
                </div>
              </div>
              <StatusChip tone={item.statusTone}>{item.statusLabel}</StatusChip>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
      )}
    </div>
  );
}
