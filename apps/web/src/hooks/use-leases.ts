import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface LeaseWithApartment {
  id: string;
  status: "DRAFT" | "ACTIVE" | "ENDED" | "TERMINATED";
  startDate: string;
  endDate: string;
  rentAmountEUR: string;
  rentVatIncluded: boolean;
  termMonths: number | null;
  depositAmountEUR: string;
  depositStatus: "HELD" | "PARTIALLY_RETURNED" | "RETURNED";
  apartmentId: string;
  apartment: { id: string; ownerId: string; name: string; addressLine: string; city: string };
  owner?: { id: string; companyName: string };
  tenant?: { id: string; firstName: string; lastName: string };
}

export function useMyLeases() {
  return useQuery({
    queryKey: ["leases", "mine"],
    queryFn: () => apiFetch<Paginated<LeaseWithApartment>>("/leases?pageSize=20"),
  });
}

export function useLeases(params: { status?: string; apartmentId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (params.status) query.set("status", params.status);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  return useQuery({
    queryKey: ["leases", "all", params],
    queryFn: () => apiFetch<Paginated<LeaseWithApartment>>(`/leases?${query.toString()}`),
  });
}

export interface CreateLeaseInput {
  apartmentId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  rentAmountEUR: number;
  rentVatIncluded?: boolean;
  termMonths?: number;
  depositAmountEUR: number;
  status?: "DRAFT" | "ACTIVE";
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaseInput) =>
      apiFetch<LeaseWithApartment>("/leases", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["apartments"] });
    },
  });
}

export function useRenewLease(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { startDate: string; endDate: string; rentAmountEUR: number }) =>
      apiFetch<LeaseWithApartment>(`/leases/${id}/renew`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["apartments"] });
    },
  });
}

export function useTerminateLease(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch<LeaseWithApartment>(`/leases/${id}/terminate`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["apartments"] });
    },
  });
}
