import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
}

export function useApartmentNotes(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["notes", apartmentId],
    queryFn: () => apiFetch<Note[]>(`/apartments/${apartmentId}/notes`),
    enabled: !!apartmentId,
  });
}

export function useCreateNote(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<Note>(`/apartments/${apartmentId}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", apartmentId] }),
  });
}
