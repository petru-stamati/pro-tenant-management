import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface RentPayment {
  id: string;
  dueDate: string;
  rentAmountEUR: string;
  paidAmountEUR: string;
  outstandingAmountEUR: string;
  status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "LATE";
  paidDate: string | null;
  apartment?: { id: string; name: string };
  invoice?: { id: string } | null;
}

export function useRentPayments(params: { apartmentId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  return useQuery({
    queryKey: ["rent-payments", params],
    queryFn: () => apiFetch<Paginated<RentPayment>>(`/rent-payments?${query.toString()}`),
    enabled: params.apartmentId !== "" || params.apartmentId === undefined,
  });
}

export function useCreateRentPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { leaseId: string; dueDate: string; rentAmountEUR: number }) =>
      apiFetch<RentPayment>("/rent-payments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent-payments"] }),
  });
}

export function useRecordPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paidAmountEUR: number }) =>
      apiFetch<RentPayment>(`/rent-payments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent-payments"] }),
  });
}

export function useGenerateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/rent-payments/${id}/generate-invoice`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rent-payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
