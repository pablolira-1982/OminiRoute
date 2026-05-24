import { NextResponse } from "next/server";
import { recordCustomerUsage } from "@/lib/customer-saas/token";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.customerId || !body?.subscriptionId || !body?.tokenId) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_usage_payload",
            message: "customerId, subscriptionId and tokenId are required.",
          },
        },
        { status: 400 }
      );
    }

    await recordCustomerUsage({
      customerId: String(body.customerId),
      subscriptionId: String(body.subscriptionId),
      tokenId: String(body.tokenId),
      requestId: body.requestId ? String(body.requestId) : undefined,
      endpoint: body.endpoint ? String(body.endpoint) : undefined,
      model: body.model ? String(body.model) : undefined,
      nativeComboId: body.nativeComboId ? String(body.nativeComboId) : undefined,
      inputTokens: Number(body.inputTokens || 0),
      outputTokens: Number(body.outputTokens || 0),
      costBrl: Number(body.costBrl || 0),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "saas_usage_record_failed",
          message: error instanceof Error ? error.message : "Usage record failed",
        },
      },
      { status: 500 }
    );
  }
}
