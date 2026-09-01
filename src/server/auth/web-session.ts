import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createWebSessionToken,
  verifyWebSessionToken,
  type WebSession,
} from "@/server/auth/session-token";

export const WEB_SESSION_COOKIE = "personal_tracker_session";
const LOCAL_DEVELOPMENT_SECRET =
  "personal-tracker-local-development-session-secret-v1";

function sessionSecret(): string | null {
  const configured = process.env.TRACKER_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  return process.env.NODE_ENV === "production"
    ? null
    : LOCAL_DEVELOPMENT_SECRET;
}
export function webAuthConfigured(): boolean {
  return Boolean(accessCode() && sessionSecret());
}

function accessCode(): string {
  return (
    process.env.TRACKER_ACCESS_CODE?.trim() ||
    process.env.NEXT_PUBLIC_ACCESS_CODE?.trim() ||
    ""
  );
}

export function accessCodeMatches(received: string): boolean {
  const expected = accessCode();
  if (!expected || !received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueWebSession(userId = "brandon"): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("TRACKER_SESSION_SECRET no configurado");
  return createWebSessionToken(userId, secret);
}

export async function getWebSession(): Promise<WebSession | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookieStore = await cookies();
  return verifyWebSessionToken(
    cookieStore.get(WEB_SESSION_COOKIE)?.value,
    secret,
  );
}

export async function requireWebSession(returnTo: string): Promise<WebSession> {
  const session = await getWebSession();
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export function webSessionCookie(token: string) {
  return {
    name: WEB_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
