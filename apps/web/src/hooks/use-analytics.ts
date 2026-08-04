import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AdminSummary {
  totalApartments: number;
  occupiedApartments: number;
  vacantApartments: number;
  occupancyRate: number;
  monthlyRevenueEUR: number;
  outstandingRentEUR: number;
  outstandingRON: number;
  paidRON: number;
  invoicedRON: number;
  openMaintenanceCount: number;
  revenueByOwner: { ownerId: string; ownerName: string; monthlyRevenueEUR: number }[];
}

export interface OwnerSummary {
  totalApartments: number;
  occupiedApartments: number;
  vacantApartments: number;
  occupancyRate: number;
  monthlyRentalIncomeEUR: number;
  outstandingRentEUR: number;
  outstandingRON: number;
  paidRON: number;
  invoicedRON: number;
  openMaintenanceCount: number;
  nextLeaseExpiration: { apartmentName: string; endDate: string; daysRemaining: number } | null;
}

export interface LeaseExpiration {
  id: string;
  endDate: string;
  apartment: { id: string; name: string };
  tenant: { id: string; firstName: string; lastName: string };
  owner: { id: string; companyName: string };
}

export function useAdminSummary() {
  return useQuery({
    queryKey: ["analytics", "admin-summary"],
    queryFn: () => apiFetch<AdminSummary>("/analytics/admin/summary"),
  });
}

export function useOwnerSummary(ownerId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", "owner-summary", ownerId],
    queryFn: () => apiFetch<OwnerSummary>(`/analytics/owner/${ownerId}/summary`),
    enabled: !!ownerId,
  });
}

export function useLeaseExpirations(withinDays = 90) {
  return useQuery({
    queryKey: ["analytics", "lease-expirations", withinDays],
    queryFn: () => apiFetch<LeaseExpiration[]>(`/analytics/lease-expirations?withinDays=${withinDays}`),
  });
}
