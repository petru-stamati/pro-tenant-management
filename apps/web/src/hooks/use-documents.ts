import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getAccessToken } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export interface DocumentItem {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  apartment?: { id: string; name: string } | null;
}

export function useDocuments(params: { apartmentId?: string; leaseId?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.leaseId) query.set("leaseId", params.leaseId);
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => apiFetch<Paginated<DocumentItem>>(`/documents?${query.toString()}`),
  });
}

export interface UploadDocumentInput {
  file: File;
  category: string;
  apartmentId?: string;
  leaseId?: string;
}

/** Runs the full three-step flow (Phase 3 §11): upload-url -> raw PUT -> complete. */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, category, apartmentId, leaseId }: UploadDocumentInput) => {
      const { documentId, uploadUrl } = await apiFetch<{ documentId: string; uploadUrl: string }>(
        "/documents/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            category,
            apartmentId,
            leaseId,
          }),
        },
      );

      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${API_URL}${uploadUrl}`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      return apiFetch(`/documents/${documentId}/complete`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

/**
 * A plain <a href> can't carry the Bearer token this endpoint requires (the
 * access token deliberately never lives in a cookie), so downloads go
 * through fetch + a synthetic anchor click on an object URL instead.
 */
export async function downloadDocument(id: string, fileName: string) {
  const res = await fetch(`${API_URL}/documents/${id}/download`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
