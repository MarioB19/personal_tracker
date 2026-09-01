import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1_000;
const MAX_FAILURES = 5;
const attempts = new Map<string, { failures: number; resetAt: number }>();

function pruneExpired(now: number) {
  if (attempts.size < 500) return;
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}

export function loginAttemptKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 240) || "unknown";
  return createHash("sha256")
    .update(`${address}\n${userAgent}`)
    .digest("hex");
}

export function loginRateLimitStatus(key: string, now = Date.now()) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    if (entry) attempts.delete(key);
    return { blocked: false, retryAfterSeconds: 0 };
  }
  return {
    blocked: entry.failures >= MAX_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

export function recordLoginFailure(key: string, now = Date.now()) {
  pruneExpired(now);
  const current = attempts.get(key);
  const next =
    current && current.resetAt > now
      ? { ...current, failures: current.failures + 1 }
      : { failures: 1, resetAt: now + WINDOW_MS };
  attempts.set(key, next);
  return loginRateLimitStatus(key, now);
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

export function resetLoginRateLimitForTests() {
  attempts.clear();
}
