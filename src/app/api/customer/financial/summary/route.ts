import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const db = createSupabaseServiceClient();

  const [{ data: payments }, { data: subs }] = await Promise.all([
    db.from("customer_payments").select("amount_brl,status,created_at"),
    db.from("customer_subscriptions").select("status"),
  ]);

  const paid = (payments || []).filter((p) => p.status === "paid");
  const totalRevenue = paid.reduce((acc, p) => acc + Number(p.amount_brl || 0), 0);

  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonth = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const revenueThisMonth = paid
    .filter((p) => monthKey(p.created_at) === thisMonth)
    .reduce((acc, p) => acc + Number(p.amount_brl || 0), 0);

  const revenueLastMonth = paid
    .filter((p) => monthKey(p.created_at) === lastMonth)
    .reduce((acc, p) => acc + Number(p.amount_brl || 0), 0);

  const paidCustomers = new Set(
    (payments || []).filter((p) => p.status === "paid").map((p: any) => p.customer_id)
  ).size;

  const statusCounts = (subs || []).reduce(
    (acc: Record<string, number>, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return NextResponse.json({
    totalRevenue,
    monthlyRecurringRevenue: revenueThisMonth,
    paidCustomers,
    pendingPayments: (payments || []).filter((p) => p.status === "pending").length,
    overdueCustomers: (payments || []).filter((p) => p.status === "overdue").length,
    suspendedCustomers: statusCounts.suspended || 0,
    revenueThisMonth,
    revenueLastMonth,
  });
}
