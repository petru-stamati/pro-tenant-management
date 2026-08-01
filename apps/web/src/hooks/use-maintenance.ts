import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export type MaintenanceStatus =
  | "REPORTED"
  | "TRIAGED"
  | "PROPOSAL_CREATED"
  | "PENDING_OWNER_APPROVAL"
  | "IN_PROGRESS"
  | "REPAIRED"
  | "COMPLETED"
  | "CANCELLED";

export interface MaintenanceRequestSummary {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  status: MaintenanceStatus;
  createdAt: string;
  apartment?: { id: string; ownerId: string; name: string };
}

export interface MaintenanceProposal {
  id: string;
  version: number;
  contractorName: string;
  costEUR: string;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  createdAt: string;
}

export interface MaintenanceStatusEvent {
  id: string;
  fromStatus: MaintenanceStatus | null;
  toStatus: MaintenanceStatus;
  note: string | null;
  createdAt: string;
}

export interface MaintenanceRequestDetail extends MaintenanceRequestSummary {
  apartment: { id: string; ownerId: string; name: string };
  cancelReason: string | null;
  proposals?: MaintenanceProposal[];
  statusEvents?: MaintenanceStatusEvent[];
}

export interface MaintenanceComment {
  id: string;
  body: string;
  visibleToTenant: boolean;
  createdAt: string;
  authorId: string;
}

export function useMaintenanceRequests(params: { apartmentId?: string; status?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.status) query.set("status", params.status);
  return useQuery({
    queryKey: ["maintenance-requests", params],
    queryFn: () => apiFetch<Paginated<MaintenanceRequestSummary>>(`/maintenance-requests?${query.toString()}`),
  });
}

export function useMaintenanceRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["maintenance-requests", "detail", id],
    queryFn: () => apiFetch<MaintenanceRequestDetail>(`/maintenance-requests/${id}`),
    enabled: !!id,
  });
}

export function useMaintenanceComments(id: string | undefined) {
  return useQuery({
    queryKey: ["maintenance-requests", "comments", id],
    queryFn: () => apiFetch<MaintenanceComment[]>(`/maintenance-requests/${id}/comments`),
    enabled: !!id,
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { apartmentId: string; title: string; description: string; urgent?: boolean }) =>
      apiFetch<MaintenanceRequestSummary>("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] }),
  });
}

function useInvalidateRequest(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
    queryClient.invalidateQueries({ queryKey: ["maintenance-requests", "detail", id] });
  };
}

export function useChangeMaintenanceStatus(id: string) {
  const invalidate = useInvalidateRequest(id);
  return useMutation({
    mutationFn: (input: { toStatus: MaintenanceStatus; note?: string }) =>
      apiFetch(`/maintenance-requests/${id}/status`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useCancelMaintenanceRequest(id: string) {
  const invalidate = useInvalidateRequest(id);
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/maintenance-requests/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: invalidate,
  });
}

export function useCreateProposal(id: string) {
  const invalidate = useInvalidateRequest(id);
  return useMutation({
    mutationFn: (input: { contractorName: string; costEUR: number; description: string }) =>
      apiFetch(`/maintenance-requests/${id}/proposals`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useDecideProposal(requestId: string, proposalId: string) {
  const invalidate = useInvalidateRequest(requestId);
  return useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      apiFetch(`/maintenance-requests/${requestId}/proposals/${proposalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: invalidate,
  });
}

export function useCreateComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; visibleToTenant?: boolean }) =>
      apiFetch<MaintenanceComment>(`/maintenance-requests/${id}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance-requests", "comments", id] }),
  });
}
