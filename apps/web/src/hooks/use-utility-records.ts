import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface UtilityRecord {
  id: string;
  utilityType: "ELECTRICITY" | "GAS" | "COLD_WATER" | "HOT_WATER" | "HEATING";
  periodMonth: string;
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  invoiceAmountRON: string;
  invoiceStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "LATE";
  apartment?: { id: string; name: string };
}

export function useUtilityRecords(params: { apartmentId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  return useQuery({
    queryKey: ["utility-records", params],
    queryFn: () => apiFetch<Paginated<UtilityRecord>>(`/utility-records?${query.toString()}`),
  });
}

export interface CreateUtilityInput {
  apartmentId: string;
  utilityType: string;
  periodMonth: string;
  previousReading?: number;
  currentReading?: number;
  invoiceAmountRON?: number;
}

export function useCreateUtilityRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUtilityInput) =>
      apiFetch<UtilityRecord>("/utility-records", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utility-records"] }),
  });
}
