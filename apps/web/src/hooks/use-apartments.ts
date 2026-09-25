import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface ApartmentSummary {
  id: string;
  ownerId: string;
  name: string;
  addressLine: string;
  city: string;
  sector: string | null;
  status: "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE";
  currentLeaseId: string | null;
  currentLease: {
    id: string;
    rentAmountEUR: string;
    tenantId: string;
    endDate: string;
    tenant?: { id: string; firstName: string; lastName: string } | null;
  } | null;
  creditBalanceRON: string;
  coverDocumentId: string | null;
}

export function useApartments(params: { ownerId?: string; status?: string; search?: string; enabled?: boolean } = {}) {
  const { enabled = true, ...filters } = params;
  const query = new URLSearchParams();
  if (filters.ownerId) query.set("ownerId", filters.ownerId);
  if (filters.status) query.set("status", filters.status);
  if (filters.search) query.set("search", filters.search);
  query.set("pageSize", "50");

  return useQuery({
    queryKey: ["apartments", filters],
    queryFn: () => apiFetch<Paginated<ApartmentSummary>>(`/apartments?${query.toString()}`),
    enabled,
  });
}

export interface ApartmentDetail extends ApartmentSummary {
  building: string | null;
  floor: number | null;
  totalFloors: number | null;
  surfaceM2: string | null;
  rooms: string | null;
  furnished: string | null;
  extras: string[];
}

export function useApartment(id: string | undefined) {
  return useQuery({
    queryKey: ["apartments", "detail", id],
    queryFn: () => apiFetch<ApartmentDetail>(`/apartments/${id}`),
    enabled: !!id,
  });
}

export interface ApartmentInput {
  ownerId: string;
  name: string;
  addressLine: string;
  city: string;
  sector?: string;
  building?: string;
  floor?: number;
  totalFloors?: number;
  surfaceM2?: number;
  rooms?: string;
  furnished?: string;
  status?: "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE";
  coverDocumentId?: string;
}

export function useCreateApartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApartmentInput) =>
      apiFetch<ApartmentDetail>("/apartments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apartments"] }),
  });
}

export interface TenantHistoryEntry {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmountEUR: string;
  tenant: { id: string; firstName: string; lastName: string };
}

export function useTenantHistory(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["apartments", "tenant-history", apartmentId],
    queryFn: () => apiFetch<TenantHistoryEntry[]>(`/apartments/${apartmentId}/tenant-history`),
    enabled: !!apartmentId,
  });
}

export function useUpdateApartment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ApartmentInput>) =>
      apiFetch<ApartmentDetail>(`/apartments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apartments"] });
    },
  });
}
