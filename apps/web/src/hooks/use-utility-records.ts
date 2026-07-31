import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export const TRACKED_UTILITY_TYPES = ["ELECTRICITY", "GAS", "COLD_WATER"] as const;
export type TrackedUtilityType = (typeof TRACKED_UTILITY_TYPES)[number];

export interface UtilityRecord {
  id: string;
  utilityType: "ELECTRICITY" | "GAS" | "COLD_WATER" | "HOT_WATER" | "HEATING";
  periodMonth: string;
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  invoiceAmountRON: string;
  invoiceStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "LATE";
  apartment?: { id: string; ownerId: string; name: string };
}

export function useUtilityRecords(params: { apartmentId?: string; utilityType?: string; month?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.utilityType) query.set("utilityType", params.utilityType);
  if (params.month) query.set("month", params.month);
  return useQuery({
    queryKey: ["utility-records", params],
    queryFn: () => apiFetch<Paginated<UtilityRecord>>(`/utility-records?${query.toString()}`),
  });
}

/** Most recent record on file for this apartment+type (any month, newest first) — used to carry the reading forward. */
export function useLastUtilityRecord(apartmentId: string | undefined, utilityType: string | undefined) {
  const query = new URLSearchParams({ pageSize: "1" });
  if (apartmentId) query.set("apartmentId", apartmentId);
  if (utilityType) query.set("utilityType", utilityType);
  return useQuery({
    queryKey: ["utility-records", "last", apartmentId, utilityType],
    queryFn: () => apiFetch<Paginated<UtilityRecord>>(`/utility-records?${query.toString()}`),
    enabled: !!apartmentId && !!utilityType,
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
