"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLatestExchangeRate } from "@/hooks/use-exchange-rate";
import { cn } from "@/lib/utils";

function ExchangeRateWidget() {
  const { data: rate, isLoading, isError } = useLatestExchangeRate();

  if (isLoading || isError || !rate) return null;

  return (
    <div className="rounded-[9px] bg-sidebar-accent/40 px-3 py-2.5">
      <div className="text-[10px] font-medium tracking-[1px] text-sidebar-foreground/50 uppercase">BNR rate</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono-tabular font-mono text-[15px] font-semibold text-white">
          {Number(rate.rateRON).toFixed(4)}
        </span>
        <span className="text-[11px] text-sidebar-foreground/70">RON/EUR</span>
      </div>
      <div className="mt-0.5 text-[10.5px] text-sidebar-foreground/50">
        {new Date(rate.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
      </div>
    </div>
  );
}

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Shared shell for the PM/Owner/Tenant sections — same dark sidebar system
 * as the approved mockup, with each section supplying its own nav.
 */
export function AppShell({
  sections,
  children,
}: {
  sections: NavSection[];
  children: React.ReactNode;
}) {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Collapse the mobile drawer whenever the route changes (link click, back button, etc).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  const brand = (
    <div className="flex items-center gap-2.5 px-2 pb-5 pt-1.5">
      <div className="relative h-[22px] w-[22px] shrink-0">
        <span className="absolute left-0 h-[22px] w-2 -skew-x-12 rounded-sm bg-white/90" />
        <span className="absolute left-[9px] h-[22px] w-2 -skew-x-12 rounded-sm bg-primary" />
      </div>
      <div className="leading-tight">
        <div className="font-heading text-[15px] font-semibold text-white">PRO TENANT</div>
        <div className="text-[10.5px] tracking-[1.5px] text-primary">MANAGEMENT</div>
      </div>
    </div>
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {section.title && (
            <div className="mb-1.5 mt-4 px-2 text-[10.5px] font-medium tracking-[1.2px] text-sidebar-foreground/50 uppercase">
              {section.title}
            </div>
          )}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-[9px] border-l-[3px] px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  active
                    ? "border-primary bg-sidebar-accent text-white"
                    : "border-transparent text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const signOut = (
    <button
      onClick={() => logout().then(() => router.push("/login"))}
      className="rounded-[9px] px-3 py-2.5 text-left text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
    >
      Sign out
    </button>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_1fr]">
      {/* Mobile top bar — hidden at md+ where the sidebar is always visible inline */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-accent/40 bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          <div className="relative h-[18px] w-[18px] shrink-0">
            <span className="absolute left-0 h-[18px] w-[7px] -skew-x-12 rounded-sm bg-white/90" />
            <span className="absolute left-[7px] h-[18px] w-[7px] -skew-x-12 rounded-sm bg-primary" />
          </div>
          <span className="font-heading text-[14px] font-semibold text-white">PRO TENANT</span>
        </div>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Backdrop for the mobile drawer */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[236px] -translate-x-full flex-col gap-0.5 overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          navOpen && "translate-x-0",
        )}
      >
        {brand}
        {nav}
        <div className="mt-auto flex flex-col gap-2">
          <ExchangeRateWidget />
          {signOut}
        </div>
      </aside>

      <main className="overflow-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
