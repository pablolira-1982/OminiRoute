import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashCustomerToken } from "@/lib/customer-saas/token";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const customerId = String(body?.customerId || "").trim();
    const subscriptionId = String(body?.subscriptionId || "").trim();

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_payload",
            message: "customerId and subscriptionId are required.",
          },
        },
        { status: 400 }
      );
    }

    const keysUrl = new URL("/api/keys", request.url);
    const createKeyResponse = await fetch(keysUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: request.headers.get("authorization") || "",
        cookie: request.headers.get("cookie") || "",
        "x-omniroute-cli-token": request.headers.get("x-omniroute-cli-token") || "",
      },
      body: JSON.stringify({
        name: `customer-${customerId.slice(0, 8)}`,
      }),
      cache: "no-store",
    });

    const createKeyJson = await createKeyResponse.json().catch(() => ({}));
    if (!createKeyResponse.ok || typeof createKeyJson?.key !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "token_create_failed",
            message: createKeyJson?.error || "Failed to create API key via /api/keys.",
          },
        },
        { status: createKeyResponse.status || 500 }
      );
    }

    const rawToken = createKeyJson.key.trim();
    if (!rawToken.startsWith("sk-")) {
      return NextResponse.json(
        {
          error: {
            code: "token_format_invalid",
            message: "Generated key is not in sk- format.",
          },
        },
        { status: 500 }
      );
    }

    const tokenHash = hashCustomerToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);
    const db = createSupabaseServiceClient();

    const { error } = await db.from("customer_tokens").insert({
      customer_id: customerId,
      subscription_id: subscriptionId,
      omni_api_key_id: typeof createKeyJson?.id === "string" ? createKeyJson.id : null,
      token_prefix: tokenPrefix,
      token_hash: tokenHash,
      status: "active",
    });

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "token_create_failed",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      token: rawToken,
      tokenPrefix,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "token_generate_failed",
          message: error instanceof Error ? error.message : "Token generation failed",
        },
      },
      { status: 500 }
    );
  }
}
