import { NextResponse } from "next/server";
import { getWebSession } from "@/server/auth/web-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getWebSession();
  return NextResponse.json(
    {
      authenticated: Boolean(session),
      userId: session?.userId ?? null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
