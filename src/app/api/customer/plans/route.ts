import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from("saas_plans").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data || [] });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const payload = {
    name: String(body?.name || "").trim(),
    description: body?.description ? String(body.description) : null,
    native_combo_id: String(body?.nativeComboId || "").trim(),
    native_combo_name: body?.nativeComboName ? String(body.nativeComboName) : null,
    monthly_token_limit: Number(body?.monthlyTokenLimit || 0),
    price_brl: Number(body?.priceBrl || 0),
    billing_interval: body?.billingInterval === "yearly" ? "yearly" : "monthly",
    status: body?.status || "active",
  };

  if (!payload.name || !payload.native_combo_id || payload.monthly_token_limit <= 0) {
    return NextResponse.json({ error: "Invalid plan payload" }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from("saas_plans").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data }, { status: 201 });
}
