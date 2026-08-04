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
  apartmentId?: string | null;
  utilityRecordId?: string | null;
  apartmentInvoiceId?: string | null;
  periodMonth?: string | null;
  apartment?: { id: string; name: string } | null;
  utilityRecord?: { id: string; periodMonth: string; utilityType: string } | null;
}

export function useDocuments(
  params: {
    apartmentId?: string;
    leaseId?: string;
    category?: string;
    utilityRecordId?: string;
    apartmentInvoiceId?: string;
    paymentConfirmationId?: string;
    taskId?: string;
    unassigned?: boolean;
  } = {},
) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.leaseId) query.set("leaseId", params.leaseId);
  if (params.category) query.set("category", params.category);
  if (params.utilityRecordId) query.set("utilityRecordId", params.utilityRecordId);
  if (params.apartmentInvoiceId) query.set("apartmentInvoiceId", params.apartmentInvoiceId);
  if (params.paymentConfirmationId) query.set("paymentConfirmationId", params.paymentConfirmationId);
  if (params.taskId) query.set("taskId", params.taskId);
  if (params.unassigned) query.set("unassigned", "true");
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
  utilityRecordId?: string;
  apartmentInvoiceId?: string;
  paymentConfirmationId?: string;
  taskId?: string;
  periodMonth?: string;
}

/** Runs the full three-step flow (Phase 3 §11): upload-url -> raw PUT -> complete. */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      category,
      apartmentId,
      leaseId,
      utilityRecordId,
      apartmentInvoiceId,
      paymentConfirmationId,
      taskId,
      periodMonth,
    }: UploadDocumentInput) => {
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
            utilityRecordId,
            apartmentInvoiceId,
            paymentConfirmationId,
            taskId,
            periodMonth,
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

export interface AssignInvoiceInput {
  id: string;
  apartmentId: string;
  type: "RENT" | "UTILITIES" | "RENT_AND_UTILITIES";
  invoiceNumber?: string;
  issueDate: string;
  dueDate: string;
  periodMonth: string;
  totalAmountRON: number;
}

/** PM's triage action — turns an Owner's unassigned invoice upload into a real ApartmentInvoice. */
export function useAssignInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AssignInvoiceInput) =>
      apiFetch(`/documents/${id}/assign-invoice`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["apartment-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
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

/** Like downloadDocument, but opens in a new tab for inline viewing instead of forcing a download. */
export async function viewDocument(id: string) {
  const res = await fetch(`${API_URL}/documents/${id}/download`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Could not open document");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
