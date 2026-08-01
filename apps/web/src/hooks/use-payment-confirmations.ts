import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";
import type { ApartmentInvoice } from "./use-apartment-invoices";

export interface PaymentApplication {
  id: string;
  invoiceId: string;
  amountRON: string;
  invoice?: ApartmentInvoice;
}

export interface PaymentConfirmationDocument {
  id: string;
  fileName: string;
}

export interface PaymentConfirmation {
  id: string;
  apartmentId: string;
  ownerId: string;
  totalAmountRON: string;
  paymentDate: string;
  notes: string | null;
  applications: PaymentApplication[];
  documents?: PaymentConfirmationDocument[];
}

export function usePaymentConfirmations(params: { apartmentId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  return useQuery({
    queryKey: ["payment-confirmations", params],
    queryFn: () => apiFetch<Paginated<PaymentConfirmation>>(`/payment-confirmations?${query.toString()}`),
  });
}

export interface PaymentApplicationInput {
  invoiceId: string;
  amountRON?: number;
  paidInFull?: boolean;
}

export interface CreatePaymentConfirmationInput {
  apartmentId: string;
  paymentDate: string;
  notes?: string;
  applications: PaymentApplicationInput[];
}

export function useCreatePaymentConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentConfirmationInput) =>
      apiFetch<PaymentConfirmation>("/payment-confirmations", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-confirmations"] });
      queryClient.invalidateQueries({ queryKey: ["apartment-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
