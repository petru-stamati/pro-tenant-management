import { AppShell } from "@/components/app-shell";

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="pm">{children}</AppShell>;
}
