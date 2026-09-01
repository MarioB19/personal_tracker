import { NextResponse } from "next/server";
import { isMonthKey, monthInMexicoCity } from "@/lib/time/month";
import { getWebSession } from "@/server/auth/web-session";
import {
  fetchVibeBusinessSummary,
  VibeIntegrationError,
} from "@/server/integrations/vibe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesión requerida" } },
      { status: 401 },
    );
  }

  const requestedMonth = new URL(request.url).searchParams.get("month");
  const month = requestedMonth || monthInMexicoCity();
  if (!isMonthKey(month) || month > monthInMexicoCity()) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_MONTH",
          message: "El mes debe usar YYYY-MM y no puede estar en el futuro",
        },
      },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchVibeBusinessSummary(month);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const integrationError =
      error instanceof VibeIntegrationError
        ? error
        : new VibeIntegrationError(
            "VIBE_UNAVAILABLE",
            "No fue posible consultar Vibe en este momento",
          );
    return NextResponse.json(
      {
        error: {
          code: integrationError.code,
          message: integrationError.message,
        },
      },
      { status: integrationError.status },
    );
  }
}
