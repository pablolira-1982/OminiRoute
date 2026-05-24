import { NextResponse } from "next/server";
import { requireCustomerPortalAuth } from "@/lib/customer-saas/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getDbInstance } from "@/lib/db/core";

export async function GET(request: Request) {
  const auth = await requireCustomerPortalAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("customer_usage_ledger")
    .select("id,request_id,endpoint,model,input_tokens,output_tokens,total_tokens,cost_brl,created_at")
    .eq("customer_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: tokenRow } = await supabase
    .from("customer_tokens")
    .select("omni_api_key_id")
    .eq("customer_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nativeUsage: Array<Record<string, unknown>> = [];
  if (tokenRow?.omni_api_key_id) {
    try {
      const db = getDbInstance();
      nativeUsage = (db
        .prepare(
          `SELECT
             id,
             api_key_id,
             provider,
             model,
             tokens_input,
             tokens_output,
             (COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) AS total_tokens,
             timestamp
           FROM usage_history
           WHERE api_key_id = ?
           ORDER BY timestamp DESC
           LIMIT 500`
        )
        .all(tokenRow.omni_api_key_id) ?? []) as Array<Record<string, unknown>>;
    } catch {
      nativeUsage = [];
    }
  }

  return NextResponse.json({
    usage: data || [],
    nativeUsage,
  });
}
