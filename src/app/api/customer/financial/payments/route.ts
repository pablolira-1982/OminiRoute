import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("customer_payments")
    .select(
      "id,customer_id,amount_brl,status,payment_method,paid_at,due_at,invoice_id,transaction_reference,created_at,customer:profiles(name,email),subscription:customer_subscriptions(id,plan:saas_plans(name))"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data || [] });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const payload = {
    customer_id: String(body?.customerId || "").trim(),
    subscription_id: body?.subscriptionId ? String(body.subscriptionId) : null,
    amount_brl: Number(body?.amountBrl || 0),
    status: body?.status || "pending",
    payment_method: body?.paymentMethod ? String(body.paymentMethod) : null,
    invoice_id: body?.invoiceId ? String(body.invoiceId) : null,
    transaction_reference: body?.transactionReference ? String(body.transactionReference) : null,
    paid_at: body?.paidAt ? String(body.paidAt) : null,
    due_at: body?.dueAt ? String(body.dueAt) : null,
  };

  if (!payload.customer_id || payload.amount_brl < 0) {
    return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from("customer_payments").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data }, { status: 201 });
}
