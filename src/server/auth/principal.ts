import { timingSafeEqual } from "node:crypto";

export type ApiScope =
  | "tracker.read"
  | "finance.read"
  | "finance.write"
  | "goals.read"
  | "goals.write"
  | "agenda.read"
  | "agenda.write"
  | "reviews.write";

export interface Principal {
  actorId: string;
  trackerUserId: string;
  authMethod: "local";
  scopes: ApiScope[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const LOCAL_SCOPES: ApiScope[] = [
  "tracker.read",
  "finance.read",
  "finance.write",
  "goals.read",
  "goals.write",
  "agenda.read",
  "agenda.write",
  "reviews.write",
];

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function tokenMatches(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isLocalApiConfigured() {
  return (
    process.env.TRACKER_API_ALLOW_LOCAL_TOKEN === "true" &&
    Boolean(process.env.TRACKER_LOCAL_API_TOKEN)
  );
}

export function authenticateRequest(
  request: Request,
  requiredScope: ApiScope,
): Principal {
  if (!isLocalApiConfigured()) {
    throw new ApiError(
      503,
      "API_AUTH_NOT_CONFIGURED",
      "La autenticación local de la API no está configurada",
    );
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    throw new ApiError(
      403,
      "LOCAL_TOKEN_REQUIRES_LOOPBACK",
      "El token local solo puede usarse mediante loopback",
    );
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  const configuredToken = process.env.TRACKER_LOCAL_API_TOKEN ?? "";

  if (!match || !tokenMatches(match[1], configuredToken)) {
    throw new ApiError(401, "UNAUTHORIZED", "Token de API inválido");
  }

  if (!LOCAL_SCOPES.includes(requiredScope)) {
    throw new ApiError(403, "FORBIDDEN", "El token no tiene el alcance requerido");
  }

  return {
    actorId: "codex-local",
    trackerUserId: process.env.TRACKER_USER_ID || "brandon",
    authMethod: "local",
    scopes: [...LOCAL_SCOPES],
  };
}
