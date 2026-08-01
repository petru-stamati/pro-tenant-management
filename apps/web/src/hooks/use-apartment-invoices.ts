import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export type ApartmentInvoiceType = "RENT" | "UTILITIES" | "RENT_AND_UTILITIES";
export type ApartmentInvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface ApartmentInvoiceDocument {
  id: string;
  fileName: string;
}

export interface ApartmentInvoice {
  id: string;
  apartmentId: string;
  ownerId: string;
  leaseId: string | null;
  type: ApartmentInvoiceType;
  invoiceNumber: string | null;
  issueDate: string;
  dueDate: string;
  periodMonth: string;
  totalAmountRON: string;
  paidAmountRON: string;
  outstandingAmountRON: string;
  status: ApartmentInvoiceStatus;
  autoExtracted: boolean;
  documents?: ApartmentInvoiceDocument[];
  apartment?: { id: string; ownerId: string; name: string };
}

export function useApartmentInvoices(params: { apartmentId?: string; month?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.month) query.set("month", params.month);
  return useQuery({
    queryKey: ["apartment-invoices", params],
    queryFn: () => apiFetch<Paginated<ApartmentInvoice>>(`/apartment-invoices?${query.toString()}`),
  });
}

export interface CreateApartmentInvoiceInput {
  apartmentId: string;
  leaseId?: string;
  type: ApartmentInvoiceType;
  invoiceNumber?: string;
  issueDate: string;
  dueDate: string;
  periodMonth: string;
  totalAmountRON: number;
  autoExtracted?: boolean;
}

export function useCreateApartmentInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApartmentInvoiceInput) =>
      apiFetch<ApartmentInvoice>("/apartment-invoices", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apartment-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export interface UpdateApartmentInvoiceInput {
  id: string;
  type?: ApartmentInvoiceType;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  periodMonth?: string;
  totalAmountRON?: number;
}

export function useUpdateApartmentInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateApartmentInvoiceInput) =>
      apiFetch<ApartmentInvoice>(`/apartment-invoices/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apartment-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
