"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApartment, useTenantHistory } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useRentPayments } from "@/hooks/use-rent-payments";
import { useUtilityRecords } from "@/hooks/use-utility-records";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { useApartmentNotes, useCreateNote } from "@/hooks/use-notes";
import { useShowings, useCreateShowing, useDeleteShowing } from "@/hooks/use-showings";
import { ApartmentFinancialsTab } from "@/components/apartment-financials-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip, apartmentStatusTone, apartmentStatusLabel, paymentStatusTone } from "@/components/status-chip";
import { ApartmentFormDialog } from "@/components/apartment-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEUR, formatRON, dateFormatter } from "@/lib/format";

const MAINTENANCE_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  TRIAGED: "Inspected",
  PROPOSAL_CREATED: "Quote proposed",
  PENDING_OWNER_APPROVAL: "Pending approval",
  IN_PROGRESS: "In progress",
  REPAIRED: "Repaired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: apartment, isLoading } = useApartment(id);
  const { data: owners } = useOwners();

  if (isLoading || !apartment) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const ownerName = owners?.data.find((o) => o.id === apartment.ownerId)?.companyName;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold">{apartment.name}</h1>
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {apartment.city}
            {apartment.sector ? `, ${apartment.sector}` : ""} · Owned by {ownerName ?? "—"}
            <StatusChip tone={apartmentStatusTone(apartment.status)}>{apartmentStatusLabel(apartment.status)}</StatusChip>
          </p>
        </div>
        <ApartmentFormDialog apartment={apartment} trigger={<Button variant="outline">Edit apartment</Button>} />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="payments">Rent Payments</TabsTrigger>
          <TabsTrigger value="utilities">Utilities</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="showings">Showings</TabsTrigger>
          <TabsTrigger value="history">Tenant History</TabsTrigger>
          {user?.role === "ADMIN" && <TabsTrigger value="notes">Notes 🔒</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoItem label="Building" value={apartment.building ?? "—"} />
            <InfoItem label="Floor" value={apartment.floor ? `${apartment.floor} of ${apartment.totalFloors ?? "—"}` : "—"} />
            <InfoItem label="Surface" value={apartment.surfaceM2 ? `${apartment.surfaceM2} m²` : "—"} />
            <InfoItem label="Rooms" value={apartment.rooms ?? "—"} />
            <InfoItem label="Furnished" value={apartment.furnished ?? "—"} />
            <InfoItem label="Extras" value={apartment.extras.length ? apartment.extras.join(", ") : "—"} />
          </div>
        </TabsContent>

        <TabsContent value="financials" className="mt-5">
          <ApartmentFinancialsTab apartmentId={id} canEdit={true} />
        </TabsContent>

        <TabsContent value="payments" className="mt-5">
          <RentPaymentsTab apartmentId={id} />
        </TabsContent>

        <TabsContent value="utilities" className="mt-5">
          <UtilitiesTab apartmentId={id} />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-5">
          <MaintenanceTab apartmentId={id} />
        </TabsContent>

        <TabsContent value="showings" className="mt-5">
          <ShowingsTab apartmentId={id} />
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <TenantHistoryTab apartmentId={id} />
        </TabsContent>

        {user?.role === "ADMIN" && (
          <TabsContent value="notes" className="mt-5">
            <NotesTab apartmentId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3">
      <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-[14.5px] font-semibold">{value}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">{children}</div>;
}

function RentPaymentsTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useRentPayments({ apartmentId });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.data.length === 0) return <Panel><p className="text-sm text-muted-foreground">No rent payments recorded yet.</p></Panel>;
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Due Date</TableHead>
            <TableHead>Rent</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(p.dueDate))}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatEUR(p.rentAmountEUR)}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatEUR(p.paidAmountEUR)}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatEUR(p.outstandingAmountEUR)}</TableCell>
              <TableCell>
                <StatusChip tone={paymentStatusTone(p.status)}>{p.status.replace("_", " ").toLowerCase()}</StatusChip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function UtilitiesTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useUtilityRecords({ apartmentId });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.data.length === 0) return <Panel><p className="text-sm text-muted-foreground">No utility records yet.</p></Panel>;
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utility</TableHead>
            <TableHead>Prev.</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Consumption</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.utilityType.replace("_", " ")}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{u.previousReading ?? "—"}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{u.currentReading ?? "—"}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{u.consumption ?? "—"}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatRON(u.invoiceAmountRON)}</TableCell>
              <TableCell>
                <StatusChip tone={paymentStatusTone(u.invoiceStatus)}>{u.invoiceStatus.toLowerCase()}</StatusChip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function MaintenanceTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useMaintenanceRequests({ apartmentId });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.data.length === 0) return <Panel><p className="text-sm text-muted-foreground">No maintenance requests yet.</p></Panel>;
  return (
    <div className="flex flex-col gap-3">
      {data.data.map((r) => (
        <Panel key={r.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {r.title} {r.urgent && <StatusChip tone="unpaid">Urgent</StatusChip>}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">{r.description}</p>
            </div>
            <StatusChip tone={r.status === "COMPLETED" ? "done" : r.status === "CANCELLED" ? "unpaid" : "progress"}>
              {MAINTENANCE_LABEL[r.status]}
            </StatusChip>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function TenantHistoryTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useTenantHistory(apartmentId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) return <Panel><p className="text-sm text-muted-foreground">No leases on record yet.</p></Panel>;
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Rent</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((lease) => (
            <TableRow key={lease.id}>
              <TableCell>
                {lease.tenant.firstName} {lease.tenant.lastName}
              </TableCell>
              <TableCell className="font-mono-tabular font-mono">{formatEUR(lease.rentAmountEUR)}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.startDate))}</TableCell>
              <TableCell className="font-mono-tabular font-mono">{dateFormatter.format(new Date(lease.endDate))}</TableCell>
              <TableCell>{lease.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function ShowingsTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useShowings(apartmentId);
  const createShowing = useCreateShowing();
  const deleteShowing = useDeleteShowing();
  const [scheduledAt, setScheduledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [prospectName, setProspectName] = useState("");
  const [prospectContact, setProspectContact] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createShowing.mutateAsync({
        apartmentId,
        scheduledAt,
        prospectName,
        prospectContact: prospectContact || undefined,
        notes: notes || undefined,
      });
      toast.success("Showing logged");
      setProspectName("");
      setProspectContact("");
      setNotes("");
    } catch {
      toast.error("Could not log the showing");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteShowing.mutateAsync(id);
    } catch {
      toast.error("Could not remove the showing");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-muted-foreground">
            Optional — not every rental needs a logged showing (some get rented just by phone), but good to have on record.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Input type="date" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Prospect name</Label>
              <Input required value={prospectName} onChange={(e) => setProspectName(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Contact — optional</Label>
            <Input value={prospectContact} onChange={(e) => setProspectContact(e.target.value)} placeholder="Phone or email" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Notes — optional</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="self-end" disabled={createShowing.isPending || !prospectName.trim()}>
            {createShowing.isPending ? "Saving…" : "Log showing"}
          </Button>
        </form>
      </Panel>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data && data.data.length > 0 ? (
        data.data.map((s) => (
          <Panel key={s.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-medium">{s.prospectName}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFormatter.format(new Date(s.scheduledAt))}
                  {s.prospectContact ? ` · ${s.prospectContact}` : ""}
                </p>
                {s.notes && <p className="mt-1.5 text-[13px]">{s.notes}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDelete(s.id)} disabled={deleteShowing.isPending}>
                Remove
              </Button>
            </div>
          </Panel>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No showings logged yet.</p>
      )}
    </div>
  );
}

function NotesTab({ apartmentId }: { apartmentId: string }) {
  const { data, isLoading } = useApartmentNotes(apartmentId);
  const createNote = useCreateNote(apartmentId);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            createNote.mutate(body, { onSuccess: () => setBody("") });
          }}
          className="flex flex-col gap-3"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add an internal note — never visible to the owner or tenant…"
            rows={3}
          />
          <Button type="submit" className="self-end" disabled={createNote.isPending || !body.trim()}>
            Add note
          </Button>
        </form>
      </Panel>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        data?.map((note) => (
          <Panel key={note.id}>
            <p className="text-[13.5px]">{note.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {note.author.firstName} {note.author.lastName} · {dateFormatter.format(new Date(note.createdAt))}
            </p>
          </Panel>
        ))
      )}
    </div>
  );
}
