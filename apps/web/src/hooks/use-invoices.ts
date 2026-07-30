import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface InvoiceWithLease {
  id: string;
  amountEUR: string;
  amountRON: string;
  exchangeRateRON: string;
  invoiceDate: string;
  dueDate: string;
  status: "ISSUED" | "PAID" | "OVERDUE" | "VOID";
  lease: { id: string; apartment: { id: string; name: string } };
}

export function useMyInvoices() {
  return useQuery({
    queryKey: ["invoices", "mine"],
    queryFn: () => apiFetch<Paginated<InvoiceWithLease>>("/invoices?pageSize=20"),
  });
}

export function useInvoices(params: { apartmentId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => apiFetch<Paginated<InvoiceWithLease>>(`/invoices?${query.toString()}`),
  });
}
