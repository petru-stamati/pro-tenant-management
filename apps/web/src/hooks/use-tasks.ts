import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "ANSWERED" | "COMPLETED" | "CANCELLED";
export type AssignedToRole = "ADMIN" | "OWNER";

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string };
}

export interface Task {
  id: string;
  ownerId: string;
  apartmentId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  title: string;
  description: string;
  urgent: boolean;
  status: TaskStatus;
  assignedToRole: AssignedToRole;
  createdAt: string;
  apartment?: { id: string; ownerId: string; name: string } | null;
  tenant?: { id: string; firstName: string; lastName: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string; roleId: string };
  comments?: TaskComment[];
  lease?: {
    id: string;
    startDate: string;
    endDate: string;
    rentAmountEUR: string;
    rentVatIncluded: boolean;
    termMonths: number | null;
  } | null;
}

export function useTasks(params: { apartmentId?: string; status?: string; enabled?: boolean } = {}) {
  const { enabled = true, ...filters } = params;
  const query = new URLSearchParams({ pageSize: "100" });
  if (filters.apartmentId) query.set("apartmentId", filters.apartmentId);
  if (filters.status) query.set("status", filters.status);
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => apiFetch<Paginated<Task>>(`/tasks?${query.toString()}`),
    enabled,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => apiFetch<Task>(`/tasks/${id}`),
    enabled: !!id,
  });
}

export interface CreateTaskInput {
  ownerId?: string;
  apartmentId?: string;
  tenantId?: string;
  title: string;
  description: string;
  urgent?: boolean;
  assignedToRole?: AssignedToRole;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status?: TaskStatus;
      title?: string;
      description?: string;
      urgent?: boolean;
      assignedToRole?: AssignedToRole;
    }) => apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", id] });
    },
  });
}

export function useCreateTaskComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<TaskComment>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "detail", id] }),
  });
}
