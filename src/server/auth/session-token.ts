import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebSession {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}
type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function equalSignature(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createWebSessionToken(
  userId: string,
  secret: string,
  now = Date.now(),
  ttlSeconds = 60 * 60 * 24 * 30,
): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyWebSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): WebSession | null {
  if (!token) return null;
  const [encoded, receivedSignature, extra] = token.split(".");
  if (!encoded || !receivedSignature || extra) return null;
  if (!equalSignature(receivedSignature, signature(encoded, secret))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    const current = Math.floor(now / 1000);
    if (
      typeof payload.sub !== "string" ||
      payload.sub.length < 1 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.iat > current + 60 ||
      payload.exp <= current
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}
