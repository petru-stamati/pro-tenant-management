import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type InspectionStatus = "IN_PROGRESS" | "COMPLETED";
export type InspectionOutcome = "CONFIRMED_GOOD" | "NEEDS_ATTENTION" | "REPLACED" | "REMOVED";

export interface InspectionResult {
  id: string;
  roomItemId: string;
  outcome: InspectionOutcome;
  note: string | null;
  previousItemName: string | null;
  createdAt: string;
  roomItem?: { id: string; name: string };
}

export interface Inspection {
  id: string;
  apartmentId: string;
  status: InspectionStatus;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  results: InspectionResult[];
  performedBy?: { id: string; firstName: string; lastName: string };
}

export function useInspections(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["inspections", apartmentId],
    queryFn: () => apiFetch<Inspection[]>(`/inspections?apartmentId=${apartmentId}`),
    enabled: !!apartmentId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, apartmentId: string) {
  queryClient.invalidateQueries({ queryKey: ["inspections", apartmentId] });
  queryClient.invalidateQueries({ queryKey: ["rooms"] });
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

export function useStartInspection(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Inspection>("/inspections", { method: "POST", body: JSON.stringify({ apartmentId }) }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useRecordInspectionResult(apartmentId: string, inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { roomItemId: string; outcome: InspectionOutcome; note?: string; newName?: string }) =>
      apiFetch<InspectionResult>(`/inspections/${inspectionId}/results`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useCompleteInspection(apartmentId: string, inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) =>
      apiFetch<Inspection>(`/inspections/${inspectionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}
