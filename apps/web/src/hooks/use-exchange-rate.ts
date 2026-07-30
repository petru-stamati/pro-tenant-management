import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ExchangeRate {
  id: string;
  date: string;
  rateRON: string;
  source: string;
  fetchedAt: string;
}

/** Refetches periodically so the sidebar picks up the day's BNR update without a manual reload. */
export function useLatestExchangeRate() {
  return useQuery({
    queryKey: ["exchange-rates", "latest"],
    queryFn: () => apiFetch<ExchangeRate>("/exchange-rates/latest"),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });
}
