import {
  vibeBusinessSummarySchema,
  type VibeBusinessSummary,
} from "@/contracts/vibe-business";

const MAX_RESPONSE_BYTES = 1_000_000;

export class VibeIntegrationError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 502,
  ) {
    super(message);
    this.name = "VibeIntegrationError";
    this.code = code;
    this.status = status;
  }
}

function exportUrl(month: string): URL {
  const raw = process.env.VIBE_EXPORT_URL?.trim();
  if (!raw) {
    throw new VibeIntegrationError(
      "VIBE_NOT_CONFIGURED",
      "La fuente Vibe todavía no está configurada",
      503,
    );
  }

  const url = new URL(raw);
  const allowedHost = process.env.VIBE_EXPORT_ALLOWED_HOST?.trim();
  if (!allowedHost) {
    throw new VibeIntegrationError(
      "VIBE_NOT_CONFIGURED",
      "El host permitido para Vibe todavía no está configurado",
      503,
    );
  }
  const localDevelopment =
    process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "localhost"].includes(url.hostname);

  if (
    !localDevelopment &&
    (url.protocol !== "https:" || url.hostname !== allowedHost)
  ) {
    throw new VibeIntegrationError(
      "VIBE_URL_REJECTED",
      "La URL configurada para Vibe no está autorizada",
      503,
    );
  }

  if (url.pathname !== "/api/export/v1/business-summary") {
    throw new VibeIntegrationError(
      "VIBE_URL_REJECTED",
      "La ruta configurada para Vibe no corresponde al exportador agregado",
      503,
    );
  }

  url.search = "";
  url.searchParams.set("month", month);
  return url;
}

export async function fetchVibeBusinessSummary(
  month: string,
): Promise<VibeBusinessSummary> {
  const token = process.env.VIBE_EXPORT_TOKEN?.trim() ?? "";
  if (token.length < 32) {
    throw new VibeIntegrationError(
      "VIBE_NOT_CONFIGURED",
      "La credencial de lectura de Vibe todavía no está configurada",
      503,
    );
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });
  const sitesBearer = process.env.VIBE_SITE_BYPASS_TOKEN?.trim();
  if (sitesBearer) {
    headers.set("OAI-Sites-Authorization", `Bearer ${sitesBearer}`);
  }

  const url = exportUrl(month);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new VibeIntegrationError(
      "VIBE_UNAVAILABLE",
      "No fue posible consultar Vibe en este momento",
    );
  }

  if (!response.ok) {
    throw new VibeIntegrationError(
      "VIBE_UPSTREAM_ERROR",
      `Vibe respondió con estado ${response.status}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new VibeIntegrationError(
      "VIBE_RESPONSE_TOO_LARGE",
      "La respuesta de Vibe excede el tamaño permitido",
    );
  }

  const raw = await response.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
    throw new VibeIntegrationError(
      "VIBE_RESPONSE_TOO_LARGE",
      "La respuesta de Vibe excede el tamaño permitido",
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new VibeIntegrationError(
      "VIBE_INVALID_RESPONSE",
      "Vibe devolvió una respuesta que no es JSON válido",
    );
  }

  const parsed = vibeBusinessSummarySchema.safeParse(json);
  if (!parsed.success) {
    throw new VibeIntegrationError(
      "VIBE_CONTRACT_MISMATCH",
      "La respuesta de Vibe no cumple el contrato esperado",
    );
  }
  return parsed.data;
}
