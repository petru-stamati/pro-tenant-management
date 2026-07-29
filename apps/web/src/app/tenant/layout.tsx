import { AppShell, type NavSection } from "@/components/app-shell";

const sections: NavSection[] = [
  {
    items: [
      { label: "My Apartment", href: "/tenant" },
      { label: "Invoices & Payments", href: "/tenant/invoices" },
      { label: "Documents", href: "/tenant/documents" },
      { label: "Report an Issue", href: "/tenant/maintenance" },
    ],
  },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <AppShell sections={sections}>{children}</AppShell>;
}
