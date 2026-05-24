import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await request.json();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.description === "string") patch.description = body.description;
  if (typeof body?.nativeComboId === "string") patch.native_combo_id = body.nativeComboId;
  if (typeof body?.nativeComboName === "string") patch.native_combo_name = body.nativeComboName;
  if (body?.monthlyTokenLimit != null) patch.monthly_token_limit = Number(body.monthlyTokenLimit);
  if (body?.priceBrl != null) patch.price_brl = Number(body.priceBrl);
  if (typeof body?.billingInterval === "string") patch.billing_interval = body.billingInterval;
  if (typeof body?.status === "string") patch.status = body.status;

  const db = createSupabaseServiceClient();
  const { error } = await db.from("saas_plans").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const db = createSupabaseServiceClient();
  const { error } = await db.from("saas_plans").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
