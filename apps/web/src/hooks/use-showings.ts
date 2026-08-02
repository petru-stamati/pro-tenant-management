import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface Showing {
  id: string;
  apartmentId: string;
  scheduledAt: string;
  prospectName: string;
  prospectContact: string | null;
  notes: string | null;
}

export function useShowings(apartmentId: string) {
  return useQuery({
    queryKey: ["showings", apartmentId],
    queryFn: () => apiFetch<Paginated<Showing>>(`/showings?apartmentId=${apartmentId}&pageSize=50`),
    enabled: !!apartmentId,
  });
}

export interface CreateShowingInput {
  apartmentId: string;
  scheduledAt: string;
  prospectName: string;
  prospectContact?: string;
  notes?: string;
}

export function useCreateShowing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShowingInput) => apiFetch<Showing>("/showings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["showings"] }),
  });
}

export function useDeleteShowing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/showings/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["showings"] }),
  });
}
