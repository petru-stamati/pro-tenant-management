import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/owner" },
      { label: "Tasks", href: "/owner/tasks" },
      { label: "Apartments", href: "/owner/apartments" },
      { label: "Leases", href: "/owner/leases" },
      { label: "Payments", href: "/owner/payments" },
      { label: "Utilities", href: "/owner/utilities" },
      { label: "Documents", href: "/owner/documents" },
      { label: "Maintenance", href: "/owner/maintenance" },
    ],
  },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell sections={sections}>{children}</AppShell>;
}
