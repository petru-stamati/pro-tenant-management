"use client";

import { createContext, useContext, useState } from "react";

/**
 * The sidebar context switcher's selection (Sidebar Pro, README "Context
 * switcher"). Lives in the PM/Owner layout, above the page content, so it
 * survives client-side navigation between pages in that section without
 * needing a URL param.
 */
interface ScopeContextValue {
  ownerId: string | null;
  setOwnerId: (id: string | null) => void;
  apartmentId: string | null;
  setApartmentId: (id: string | null) => void;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  return (
    <ScopeContext.Provider value={{ ownerId, setOwnerId, apartmentId, setApartmentId }}>
      {children}
    </ScopeContext.Provider>
  );
}

/** Returns null outside a ScopeProvider (e.g. the tenant section) instead of throwing — scope is optional there. */
export function useScope() {
  return useContext(ScopeContext);
}
