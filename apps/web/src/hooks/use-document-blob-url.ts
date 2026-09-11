import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

/**
 * Documents are served behind an authenticated endpoint (no public URLs —
 * see downloadDocument in use-documents.ts), so an <img src=...> can't
 * point at it directly. This fetches the file as a blob with the Bearer
 * token and hands back an object URL, revoked on unmount/id change.
 */
export function useDocumentBlobUrl(documentId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!documentId) return;

    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/documents/${documentId}/download`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        });
        if (!res.ok) throw new Error("download failed");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return { url, loading: !url && !failed, failed };
}
