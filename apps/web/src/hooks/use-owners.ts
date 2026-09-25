import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface Owner {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  taxId: string | null;
  address: string | null;
}

export function useOwners(search?: string, options: { enabled?: boolean } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (search) query.set("search", search);
  return useQuery({
    queryKey: ["owners", search],
    queryFn: () => apiFetch<Paginated<Owner>>(`/owners?${query.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export interface OwnerInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
}

export function useCreateOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OwnerInput) => apiFetch<Owner>("/owners", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owners"] }),
  });
}
