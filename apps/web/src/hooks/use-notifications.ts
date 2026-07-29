import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Paginated<NotificationItem> & { unreadCount: number }>("/notifications?pageSize=10"),
  });
}
