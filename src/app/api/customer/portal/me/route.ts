import { NextResponse } from "next/server";
import { requireCustomerPortalAuth } from "@/lib/customer-saas/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireCustomerPortalAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,name,email,status,customer_subscriptions(id,status,renews_at,expires_at,token_limit,price_brl,plan:saas_plans(name,native_combo_id),customer_tokens(id,token_prefix,status,last_used_at))"
    )
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ me: data });
}
