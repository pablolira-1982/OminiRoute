import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const TOKEN_PREFIX = "sk-";

export interface CustomerTokenValidationResult {
  ok: boolean;
  code?:
    | "invalid_customer_token"
    | "customer_suspended"
    | "customer_token_suspended"
    | "subscription_expired"
    | "usage_limit_exceeded"
    | "payment_overdue";
  message?: string;
  customerId?: string;
  subscriptionId?: string;
  tokenId?: string;
  nativeComboId?: string;
}

function getHashPepper(): string {
  return process.env.SAAS_TOKEN_HASH_PEPPER?.trim() || "";
}

export function hashCustomerToken(rawToken: string): string {
  return createHash("sha256").update(`${getHashPepper()}::${rawToken}`).digest("hex");
}

export function generateCustomerToken(): { rawToken: string; tokenPrefix: string; tokenHash: string } {
  const body = randomBytes(24).toString("hex");
  const rawToken = `${TOKEN_PREFIX}${body}`;
  const tokenHash = hashCustomerToken(rawToken);
  return {
    rawToken,
    tokenPrefix: rawToken.slice(0, 10),
    tokenHash,
  };
}

function isSkToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

function safeEquals(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export async function validateCustomerToken(rawToken: string): Promise<CustomerTokenValidationResult> {
  if (!rawToken || !isSkToken(rawToken)) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Invalid customer token.",
    };
  }

  const tokenHash = hashCustomerToken(rawToken);
  const db = createSupabaseServiceClient();

  const { data: tokenRow, error: tokenError } = await db
    .from("customer_tokens")
    .select("id, customer_id, subscription_id, token_hash, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Invalid customer token.",
    };
  }

  if (!safeEquals(tokenRow.token_hash, tokenHash)) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Invalid customer token.",
    };
  }

  if (tokenRow.status !== "active") {
    return {
      ok: false,
      code: "customer_token_suspended",
      message: "This customer token is suspended.",
    };
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, status")
    .eq("id", tokenRow.customer_id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Customer profile not found.",
    };
  }

  if (profile.status !== "active") {
    return {
      ok: false,
      code: "customer_suspended",
      message: "Customer account is suspended.",
    };
  }

  const { data: subscription, error: subError } = await db
    .from("customer_subscriptions")
    .select("id, status, renews_at, expires_at, token_limit, plan_id")
    .eq("id", tokenRow.subscription_id)
    .maybeSingle();

  if (subError || !subscription) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Subscription not found.",
    };
  }

  if (subscription.status !== "active") {
    return {
      ok: false,
      code: "subscription_expired",
      message: "Subscription is not active.",
    };
  }

  const now = Date.now();
  if (subscription.expires_at && new Date(subscription.expires_at).getTime() < now) {
    return {
      ok: false,
      code: "subscription_expired",
      message: "Subscription has expired.",
    };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: usageRows, error: usageError } = await db
    .from("customer_usage_ledger")
    .select("total_tokens")
    .eq("subscription_id", subscription.id)
    .gte("created_at", monthStart.toISOString());

  if (usageError) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Unable to validate usage limits.",
    };
  }

  const usedTokens = (usageRows || []).reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);
  if (usedTokens >= Number(subscription.token_limit)) {
    return {
      ok: false,
      code: "usage_limit_exceeded",
      message: "Monthly token limit exceeded.",
    };
  }

  const { data: plan, error: planError } = await db
    .from("saas_plans")
    .select("native_combo_id")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  if (planError || !plan?.native_combo_id) {
    return {
      ok: false,
      code: "invalid_customer_token",
      message: "Plan combo mapping not found.",
    };
  }

  await db
    .from("customer_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return {
    ok: true,
    customerId: tokenRow.customer_id,
    subscriptionId: tokenRow.subscription_id,
    tokenId: tokenRow.id,
    nativeComboId: plan.native_combo_id,
  };
}

export async function recordCustomerUsage(input: {
  customerId: string;
  subscriptionId: string;
  tokenId: string;
  requestId?: string;
  endpoint?: string;
  model?: string;
  nativeComboId?: string;
  inputTokens?: number;
  outputTokens?: number;
  costBrl?: number;
}): Promise<void> {
  const db = createSupabaseServiceClient();
  await db.from("customer_usage_ledger").insert({
    customer_id: input.customerId,
    subscription_id: input.subscriptionId,
    token_id: input.tokenId,
    request_id: input.requestId || null,
    endpoint: input.endpoint || null,
    model: input.model || null,
    native_combo_id: input.nativeComboId || null,
    input_tokens: Math.max(0, Math.trunc(input.inputTokens || 0)),
    output_tokens: Math.max(0, Math.trunc(input.outputTokens || 0)),
    cost_brl: input.costBrl ?? 0,
  });
}
