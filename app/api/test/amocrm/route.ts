import { NextResponse } from "next/server";
import { AmoCRMClient } from "@/lib/amocrm";

export async function GET() {
  try {
    const client = new AmoCRMClient();
    const account = await client.getAccount();

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get account information",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "AmoCRM connection successful",
      account,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("tokens not found")) {
      return NextResponse.json(
        {
          success: false,
          error: "AmoCRM tokens not found",
          details:
            "Set AMOCRM_AUTHORIZATION_CODE in .env.local or insert tokens into rte.amocrm_tokens",
        },
        { status: 400 },
      );
    }

    if (errorMessage.includes("credentials are not configured")) {
      return NextResponse.json(
        {
          success: false,
          error: "AmoCRM credentials are not configured",
          details:
            "Please check AMOCRM_SUBDOMAIN, AMOCRM_CLIENT_ID, AMOCRM_CLIENT_SECRET",
        },
        { status: 400 },
      );
    }

    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed",
          details:
            "Access token is invalid or expired. Update tokens in DB or provide AMOCRM_AUTHORIZATION_CODE.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to AmoCRM",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}