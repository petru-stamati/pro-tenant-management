import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface UtilityRate {
  id: string;
  ownerId: string;
  utilityType: "ELECTRICITY" | "GAS" | "COLD_WATER" | "HOT_WATER" | "HEATING";
  pricePerUnit: string;
  conversionFactor: string | null;
  vatPercent: string | null;
  maintenanceFee: string | null;
  maintenanceVatPercent: string | null;
}

export function useUtilityRates(ownerId?: string) {
  const query = new URLSearchParams();
  if (ownerId) query.set("ownerId", ownerId);
  return useQuery({
    queryKey: ["utility-rates", ownerId],
    queryFn: () => apiFetch<UtilityRate[]>(`/utility-rates?${query.toString()}`),
  });
}

export interface UpsertUtilityRateInput {
  ownerId: string;
  utilityType: string;
  pricePerUnit: number;
  conversionFactor?: number;
  vatPercent?: number;
  maintenanceFee?: number;
  maintenanceVatPercent?: number;
}

export function useUpsertUtilityRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertUtilityRateInput) =>
      apiFetch<UtilityRate>("/utility-rates", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utility-rates"] }),
  });
}
