import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,name,email,status,created_at,customer_subscriptions(id,status,renews_at,token_limit,price_brl,plan:saas_plans(name,native_combo_id),customer_tokens(id,token_prefix,status,last_used_at))"
    )
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: data || [] });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const planId = String(body?.planId || "").trim();

  if (!name || !email || !password || !planId) {
    return NextResponse.json(
      { error: "name, email, password and planId are required" },
      { status: 400 }
    );
  }

  const db = createSupabaseServiceClient();

  const { data: userRes, error: userError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (userError || !userRes?.user?.id) {
    return NextResponse.json({ error: userError?.message || "Failed to create user" }, { status: 500 });
  }

  const customerId = userRes.user.id;

  const { error: profileError } = await db.from("profiles").insert({
    id: customerId,
    name,
    email,
    role: "customer",
    status: "active",
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: plan, error: planError } = await db
    .from("saas_plans")
    .select("id,monthly_token_limit,price_brl")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  const { data: subscription, error: subError } = await db
    .from("customer_subscriptions")
    .insert({
      customer_id: customerId,
      plan_id: plan.id,
      status: "active",
      renews_at: renewsAt.toISOString(),
      token_limit: Number(plan.monthly_token_limit),
      price_brl: Number(plan.price_brl),
    })
    .select("id")
    .single();

  if (subError || !subscription?.id) {
    return NextResponse.json({ error: subError?.message || "Failed to create subscription" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    customerId,
    subscriptionId: subscription.id,
  });
}
