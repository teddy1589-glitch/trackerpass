import { NextRequest, NextResponse } from "next/server";
import { AmoCRMClient } from "@/lib/amocrm";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error,
          error_description: errorDescription ?? null,
        },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing authorization code" },
        { status: 400 },
      );
    }

    const client = new AmoCRMClient();
    const tokens = await client.exchangeCodeForTokens(code);

    return NextResponse.json(
      {
        success: true,
        message:
          "Tokens received. Please update AMOCRM_ACCESS_TOKEN and AMOCRM_REFRESH_TOKEN in .env.local",
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
