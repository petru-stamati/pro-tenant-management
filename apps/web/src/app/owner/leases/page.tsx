"use client";

import { LeasesBoard } from "@/components/leases-board";

export default function OwnerLeasesPage() {
  return <LeasesBoard canManage={false} />;
}
