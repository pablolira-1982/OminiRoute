import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const db = createSupabaseServiceClient();

  await db.from("profiles").update({ status: "suspended" }).eq("id", id);
  await db.from("customer_subscriptions").update({ status: "suspended" }).eq("customer_id", id);
  await db.from("customer_tokens").update({ status: "suspended" }).eq("customer_id", id);

  return NextResponse.json({ ok: true });
}
