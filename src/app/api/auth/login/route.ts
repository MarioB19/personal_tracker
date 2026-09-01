import { NextResponse } from "next/server";
import {
  accessCodeMatches,
  issueWebSession,
  webAuthConfigured,
  webSessionCookie,
} from "@/server/auth/web-session";
import {
  clearLoginFailures,
  loginAttemptKey,
  loginRateLimitStatus,
  recordLoginFailure,
} from "@/server/auth/login-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!webAuthConfigured()) {
    return NextResponse.json(
      { error: "El acceso web todavía no está configurado" },
      { status: 503 },
    );
  }

  const attemptKey = loginAttemptKey(request);
  const currentLimit = loginRateLimitStatus(attemptKey);
  if (currentLimit.blocked) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Retry-After": String(currentLimit.retryAfterSeconds),
        },
      },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  if (!accessCodeMatches(code)) {
    const nextLimit = recordLoginFailure(attemptKey);
    return NextResponse.json(
      {
        error: nextLimit.blocked
          ? "Demasiados intentos. Intenta de nuevo más tarde"
          : "Código incorrecto",
      },
      {
        status: nextLimit.blocked ? 429 : 401,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          ...(nextLimit.blocked
            ? { "Retry-After": String(nextLimit.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }

  clearLoginFailures(attemptKey);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(webSessionCookie(issueWebSession()));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
