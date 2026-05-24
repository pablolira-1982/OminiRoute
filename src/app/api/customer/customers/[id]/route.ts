import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const db = createSupabaseServiceClient();

  const { data, error } = await db
    .from("profiles")
    .select(
      "id,name,email,status,created_at,customer_subscriptions(id,status,renews_at,expires_at,token_limit,price_brl,plan:saas_plans(id,name,native_combo_id),customer_tokens(id,token_prefix,status,last_used_at,created_at))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ customer: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.status === "string") patch.status = body.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
