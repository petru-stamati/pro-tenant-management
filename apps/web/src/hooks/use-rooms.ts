import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type RoomType = "BEDROOM" | "BATHROOM" | "KITCHEN" | "HALLWAY" | "LIVING_ROOM" | "OTHER";
export type ItemCondition = "GOOD" | "NEEDS_ATTENTION";

export interface RoomItem {
  id: string;
  roomId: string;
  name: string;
  condition: ItemCondition;
  conditionNote: string | null;
}

export interface Room {
  id: string;
  apartmentId: string;
  type: RoomType;
  label: string;
  notFurnished: boolean;
  items: RoomItem[];
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, apartmentId?: string) {
  queryClient.invalidateQueries({ queryKey: ["rooms"] });
  queryClient.invalidateQueries({ queryKey: ["apartments"] });
  if (apartmentId) queryClient.invalidateQueries({ queryKey: ["apartments", "detail", apartmentId] });
}

export function useRooms(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["rooms", apartmentId],
    queryFn: () => apiFetch<Room[]>(`/rooms?apartmentId=${apartmentId}`),
    enabled: !!apartmentId,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { apartmentId: string; type: RoomType; label: string; notFurnished?: boolean }) =>
      apiFetch<Room>("/rooms", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_, input) => invalidate(queryClient, input.apartmentId),
  });
}

export function useUpdateRoom(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; type?: RoomType; label?: string; notFurnished?: boolean }) =>
      apiFetch<Room>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useDeleteRoom(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/rooms/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useCreateRoomItem(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, name }: { roomId: string; name: string }) =>
      apiFetch<RoomItem>(`/rooms/${roomId}/items`, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useUpdateRoomItem(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<RoomItem>(`/room-items/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}

export function useDeleteRoomItem(apartmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/room-items/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient, apartmentId),
  });
}
