import { NextResponse } from "next/server";
import { validateCustomerToken } from "@/lib/customer-saas/token";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    const result = await validateCustomerToken(token);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: result.code,
            message: result.message,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      customerId: result.customerId,
      subscriptionId: result.subscriptionId,
      tokenId: result.tokenId,
      nativeComboId: result.nativeComboId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "saas_token_validation_failed",
          message: error instanceof Error ? error.message : "Validation failed",
        },
      },
      { status: 500 }
    );
  }
}
