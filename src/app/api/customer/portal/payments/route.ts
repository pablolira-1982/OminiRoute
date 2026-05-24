import { NextResponse } from "next/server";
import { requireCustomerPortalAuth } from "@/lib/customer-saas/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireCustomerPortalAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("customer_payments")
    .select("id,amount_brl,status,payment_method,invoice_id,transaction_reference,paid_at,due_at,created_at")
    .eq("customer_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data || [] });
}
