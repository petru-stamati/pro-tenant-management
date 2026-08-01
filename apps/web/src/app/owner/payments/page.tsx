"use client";

import { PaymentsBoard } from "@/components/payments-board";

export default function OwnerPaymentsPage() {
  return <PaymentsBoard canRecordPayments={false} />;
}
