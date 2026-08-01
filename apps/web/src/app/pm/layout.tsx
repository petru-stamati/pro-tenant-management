import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/pm" },
      { label: "Tasks", href: "/pm/tasks" },
      { label: "Apartments", href: "/pm/apartments" },
      { label: "Owners", href: "/pm/owners" },
      { label: "Tenants", href: "/pm/tenants" },
      { label: "Leases", href: "/pm/leases" },
      { label: "Payments", href: "/pm/payments" },
      { label: "Utilities", href: "/pm/utilities" },
      { label: "Documents", href: "/pm/documents" },
      { label: "Maintenance", href: "/pm/maintenance" },
      { label: "Analytics", href: "/pm/analytics" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users & Roles", href: "/pm/users" },
      { label: "Audit Log", href: "/pm/audit-log" },
    ],
  },
];

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <AppShell sections={sections}>{children}</AppShell>;
}
