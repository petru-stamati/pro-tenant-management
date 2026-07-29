import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export function useTenants(search?: string) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (search) query.set("search", search);
  return useQuery({
    queryKey: ["tenants", search],
    queryFn: () => apiFetch<Paginated<Tenant>>(`/tenants?${query.toString()}`),
  });
}

export interface TenantWithLeases extends Tenant {
  leases: {
    id: string;
    status: string;
    apartment: { id: string; name: string };
    owner: { id: string; companyName: string };
  }[];
}

export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: ["tenants", "detail", id],
    queryFn: () => apiFetch<TenantWithLeases>(`/tenants/${id}`),
    enabled: !!id,
  });
}

export interface TenantInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TenantInput) => apiFetch<Tenant>("/tenants", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants"] }),
  });
}

export function useInviteTenant(tenantId: string) {
  return useMutation({
    mutationFn: (leaseId: string) =>
      apiFetch<{ inviteId: string; inviteLink: string; expiresAt: string }>(`/tenants/${tenantId}/invite`, {
        method: "POST",
        body: JSON.stringify({ leaseId }),
      }),
  });
}
