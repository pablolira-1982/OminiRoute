import { NextResponse } from "next/server";
import { requireCustomerPortalAuth } from "@/lib/customer-saas/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireCustomerPortalAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseServiceClient();

  const { data: sub } = await db
    .from("customer_subscriptions")
    .select("id,renews_at")
    .eq("customer_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.id) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const nextRenew = new Date(sub.renews_at || Date.now());
  nextRenew.setMonth(nextRenew.getMonth() + 1);

  const { error } = await db
    .from("customer_subscriptions")
    .update({ renews_at: nextRenew.toISOString(), status: "active" })
    .eq("id", sub.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, renewsAt: nextRenew.toISOString() });
}
