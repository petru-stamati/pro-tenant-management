"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboardIcon,
  ListChecksIcon,
  Building2Icon,
  BriefcaseIcon,
  UsersIcon,
  FileSignatureIcon,
  WalletIcon,
  ZapIcon,
  WrenchIcon,
  FolderIcon,
  HomeIcon,
  ReceiptIcon,
  ChevronsUpDownIcon,
  SearchIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useScope, ScopeProvider } from "@/lib/scope-context";
import { useLatestExchangeRate } from "@/hooks/use-exchange-rate";
import { useOpenItems } from "@/hooks/use-open-items";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { useTenants } from "@/hooks/use-tenants";
import { Slash } from "@/components/ui/slash";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Role = "pm" | "owner" | "tenant";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number; // action count — green pill
  count?: number; // plain total — mono text
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function ExchangeRateWidget() {
  const { data: rate, isLoading, isError } = useLatestExchangeRate();
  if (isLoading || isError || !rate) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-[9px] bg-[#151916] px-3 py-1.5">
      <span className="text-[9.5px] font-medium tracking-[1px] text-[#7a8076] uppercase">BNR</span>
      <span className="font-mono-tabular font-mono text-[12.5px] font-semibold text-white">
        {Number(rate.rateRON).toFixed(4)} <span className="text-[10px] font-normal text-[#7a8076]">RON/EUR</span>
      </span>
      <span className="text-[10px] text-[#7a8076]">{new Date(rate.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
    </div>
  );
}

function Logo({ compact }: { compact?: boolean }) {
  const size = compact ? 24 : 34;
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div
        className="relative shrink-0 overflow-hidden rounded-[9px] bg-primary"
        style={{ width: size, height: size }}
      >
        <Slash width={6} height={size - 14} className="absolute left-[29%] top-[21%] bg-[#0a0d0b]" />
        <Slash width={6} height={size - 14} className="absolute left-[53%] top-[21%] bg-white" />
      </div>
      <div className="leading-tight">
        <div className="font-heading text-[15px] font-bold text-white">PRO Tenant</div>
        <div className="text-[9.5px] font-medium tracking-[1.8px] text-primary">MANAGEMENT</div>
      </div>
    </div>
  );
}

/** The sidebar's "All owners / All my apartments / current lease" selector — filters PM/Owner pages by scope. */
function ContextSwitcher({ role }: { role: Role }) {
  const scope = useScope();
  const [open, setOpen] = useState(false);
  const { data: owners } = useOwners(undefined, { enabled: role === "pm" });
  const { data: apartments } = useApartments(role === "pm" ? { ownerId: scope?.ownerId ?? undefined } : {});

  if (role === "tenant") {
    const apt = apartments?.data[0];
    return (
      <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[#151916] px-3 py-2.5 shadow-[inset_0_0_0_1px_#232824]">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[#1f2420]">
          <HomeIcon className="h-[15px] w-[15px] text-[#4ade80]" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">{apt?.name ?? "My apartment"}</div>
          <div className="font-mono text-[11px] text-[#7a8076]">
            {apt?.currentLease ? `Lease to ${new Date(apt.currentLease.endDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "—"}
          </div>
        </div>
      </div>
    );
  }

  if (!scope) return null;

  const title =
    role === "pm"
      ? scope.ownerId
        ? (owners?.data.find((o) => o.id === scope.ownerId)?.companyName ?? "All owners")
        : "All owners"
      : scope.apartmentId
        ? (apartments?.data.find((a) => a.id === scope.apartmentId)?.name ?? "All my apartments")
        : "All my apartments";

  const subtitle =
    role === "pm"
      ? `${apartments?.meta.total ?? "…"} units · ${owners?.meta.total ?? "…"} owners`
      : `${apartments?.meta.total ?? "…"} units`;

  const options =
    role === "pm"
      ? [{ id: null, label: "All owners" }, ...(owners?.data.map((o) => ({ id: o.id, label: o.companyName })) ?? [])]
      : [{ id: null, label: "All my apartments" }, ...(apartments?.data.map((a) => ({ id: a.id, label: a.name })) ?? [])];

  return (
    <div className="relative mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl bg-[#151916] px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_#232824] transition-colors hover:bg-[#1a1e1b]"
      >
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[#1f2420]">
          <Building2Icon className="h-[15px] w-[15px] text-[#4ade80]" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">{title}</div>
          <div className="font-mono truncate text-[11px] text-[#7a8076]">{subtitle}</div>
        </div>
        <ChevronsUpDownIcon className="h-[15px] w-[15px] shrink-0 text-[#7a8076]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1.5 max-h-[280px] w-full overflow-y-auto rounded-xl border border-[#232824] bg-[#151916] p-1.5 shadow-xl">
            {options.map((opt) => (
              <button
                key={opt.id ?? "all"}
                type="button"
                onClick={() => {
                  if (role === "pm") scope.setOwnerId(opt.id);
                  else scope.setApartmentId(opt.id);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full truncate rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[#cfd2cd] hover:bg-[#1f2420] hover:text-white",
                  (role === "pm" ? scope.ownerId : scope.apartmentId) === opt.id && "bg-[#1f2420] text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CommandPalette({ groups, open, onOpenChange }: { groups: NavGroup[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const filtered = query.trim()
    ? flat.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
    : flat;

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] max-w-md translate-y-0 gap-0 p-0" showCloseButton={false}>
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">No matches.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-accent"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function navConfig(role: Role, counts: { openTasks: number; openMaintenance: number; apartments: number; owners: number; tenants: number }): NavGroup[] {
  if (role === "pm") {
    return [
      {
        label: "OVERVIEW",
        items: [
          { label: "Dashboard", href: "/pm", icon: LayoutDashboardIcon },
          { label: "Tasks", href: "/pm/tasks", icon: ListChecksIcon, badge: counts.openTasks },
        ],
      },
      {
        label: "PORTFOLIO",
        items: [
          { label: "Apartments", href: "/pm/apartments", icon: Building2Icon, count: counts.apartments },
          { label: "Owners", href: "/pm/owners", icon: BriefcaseIcon, count: counts.owners },
          { label: "Tenants", href: "/pm/tenants", icon: UsersIcon, count: counts.tenants },
          { label: "Leases", href: "/pm/leases", icon: FileSignatureIcon },
        ],
      },
      {
        label: "MONEY",
        items: [
          { label: "Payments", href: "/pm/payments", icon: WalletIcon },
          { label: "Utilities", href: "/pm/utilities", icon: ZapIcon },
        ],
      },
      {
        label: "OPERATIONS",
        items: [
          { label: "Maintenance", href: "/pm/maintenance", icon: WrenchIcon, badge: counts.openMaintenance },
          { label: "Documents", href: "/pm/documents", icon: FolderIcon },
        ],
      },
    ];
  }
  if (role === "owner") {
    return [
      {
        label: "OVERVIEW",
        items: [
          { label: "Dashboard", href: "/owner", icon: LayoutDashboardIcon },
          { label: "Tasks", href: "/owner/tasks", icon: ListChecksIcon, badge: counts.openTasks },
        ],
      },
      {
        label: "PORTFOLIO",
        items: [
          { label: "Apartments", href: "/owner/apartments", icon: Building2Icon, count: counts.apartments },
          { label: "Leases", href: "/owner/leases", icon: FileSignatureIcon },
        ],
      },
      {
        label: "MONEY",
        items: [
          { label: "Payments", href: "/owner/payments", icon: WalletIcon },
          { label: "Utilities", href: "/owner/utilities", icon: ZapIcon },
        ],
      },
      {
        label: "OPERATIONS",
        items: [
          { label: "Maintenance", href: "/owner/maintenance", icon: WrenchIcon, badge: counts.openMaintenance },
          { label: "Documents", href: "/owner/documents", icon: FolderIcon },
        ],
      },
    ];
  }
  return [
    {
      label: "MY HOME",
      items: [
        { label: "My Apartment", href: "/tenant", icon: HomeIcon },
        { label: "Invoices & Payments", href: "/tenant/invoices", icon: ReceiptIcon },
      ],
    },
    {
      label: "SUPPORT",
      items: [
        { label: "Documents", href: "/tenant/documents", icon: FolderIcon },
        { label: "Report an Issue", href: "/tenant/maintenance", icon: WrenchIcon },
      ],
    },
  ];
}

function AppShellInner({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { openItems } = useOpenItems(role === "owner" ? "OWNER" : "PM");
  const scope = useScope();

  const { data: apartments } = useApartments(
    role === "pm" ? { ownerId: scope?.ownerId ?? undefined } : { enabled: role === "owner" },
  );
  const { data: owners } = useOwners(undefined, { enabled: role === "pm" });
  const { data: tenants } = useTenants(undefined, { enabled: role === "pm" });

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (status !== "authenticated" || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const openTasks = openItems.filter((i) => i.kind === "task").length;
  const openMaintenance = openItems.filter((i) => i.kind === "maintenance").length;
  const groups = navConfig(role, {
    openTasks,
    openMaintenance,
    apartments: apartments?.meta.total ?? 0,
    owners: owners?.meta.total ?? 0,
    tenants: tenants?.meta.total ?? 0,
  });

  const roleLabel = role === "pm" ? "Property manager" : role === "owner" ? "Owner" : "Tenant";
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  const sidebarBody = (
    <div className="relative flex h-full flex-col overflow-hidden px-4 pb-3 pt-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[-30px] bottom-[-60px] bg-primary opacity-[.16]"
        style={{ width: 70, height: 420, transform: "skewX(-16deg)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[52px] bottom-[-60px] bg-white opacity-[.04]"
        style={{ width: 70, height: 420, transform: "skewX(-16deg)" }}
      />
      <div className="relative mb-3 flex items-center justify-between">
        <Logo />
        <button
          onClick={() => setNavOpen(false)}
          aria-label="Close menu"
          className="rounded-md p-1 text-[#7a8076] hover:text-white md:hidden"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative">
        <ContextSwitcher role={role} />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mb-1 flex h-[38px] w-full items-center gap-2.5 rounded-[10px] bg-[#151916] px-3 text-left text-[13px] text-[#7a8076] hover:bg-[#1a1e1b]"
        >
          <SearchIcon className="h-[15px] w-[15px]" />
          <span className="flex-1">Search</span>
          <span className="rounded-[5px] border border-[#262b26] px-[5px] font-mono text-[11px] font-medium">⌘K</span>
        </button>
      </div>

      <nav className="relative flex flex-1 flex-col overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold tracking-[1.4px] text-[#5b6159]">{g.label}</div>
            {g.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-8 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition-colors",
                    active ? "bg-gradient-to-r from-primary/22 to-primary/[.04] text-white font-semibold" : "text-[#a9aea6] hover:bg-[#151916] hover:text-white",
                  )}
                >
                  {active && <Slash className="absolute -left-1" height={20} />}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#4ade80]" : "text-[#6b7169]")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="rounded-full bg-[#4ade80] px-[7px] py-px font-mono text-[11px] font-semibold text-[#0a0d0b]">
                      {item.badge}
                    </span>
                  )}
                  {typeof item.count === "number" && (
                    <span className="font-mono text-[11px] text-[#5b6159]">{item.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative mt-auto flex flex-col gap-2 pt-2">
        <ExchangeRateWidget />
        <div className="flex items-center gap-2 rounded-xl bg-[#151916] px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-[10px] font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] font-semibold text-white">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate text-[10.5px] text-[#7a8076]">{roleLabel}</div>
          </div>
          <button
            onClick={() => logout().then(() => router.push("/login"))}
            aria-label="Sign out"
            className="rounded-md p-1 text-[#6b7169] hover:text-white"
          >
            <LogOutIcon className="h-[14px] w-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[272px_1fr]">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-accent/40 bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <Logo compact />
        {role === "tenant" ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-[11px] font-semibold text-white">
            {initials}
          </div>
        ) : (
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 text-[#a9aea6] hover:text-white">
            <MenuIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {navOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[272px] -translate-x-full bg-[#0a0d0b] transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          role === "tenant" ? "hidden md:flex" : navOpen && "translate-x-0",
        )}
      >
        {sidebarBody}
      </aside>

      <main className={cn("overflow-auto p-4 sm:p-6 md:p-8", role === "tenant" && "pb-20 md:pb-8")}>{children}</main>

      {role === "tenant" && <TenantTabBar />}

      <CommandPalette groups={groups} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function TenantTabBar() {
  const pathname = usePathname();
  const tabs = [
    { label: "Home", href: "/tenant", icon: HomeIcon },
    { label: "Invoices", href: "/tenant/invoices", icon: ReceiptIcon },
    { label: "Documents", href: "/tenant/documents", icon: FolderIcon },
    { label: "Requests", href: "/tenant/maintenance", icon: WrenchIcon },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card md:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-1 py-2.5">
            {active ? <Slash height={14} /> : <Icon className="h-[18px] w-[18px] text-muted-foreground" />}
            <span className={cn("text-[10.5px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  if (role === "tenant") return <AppShellInner role={role}>{children}</AppShellInner>;
  return (
    <ScopeProvider>
      <AppShellInner role={role}>{children}</AppShellInner>
    </ScopeProvider>
  );
}
