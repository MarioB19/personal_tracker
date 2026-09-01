import { weeklyTemplateReplaceSchema } from "@/contracts/agenda";
import { ApiError, authenticateRequest } from "@/server/auth/principal";
import {
  apiFailure,
  apiSuccess,
  getRequestId,
  readJson,
} from "@/server/http/responses";
import { serializeForApi } from "@/server/http/serialize";
import {
  getWeeklyTemplate,
  replaceWeeklyTemplateIdempotently,
} from "@/server/repositories/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "agenda.read");
    const template = await getWeeklyTemplate(principal.trackerUserId);
    return apiSuccess(serializeForApi(template), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "agenda.write");
    const idempotencyKey = readIdempotencyKey(request);
    const input = weeklyTemplateReplaceSchema.parse(await readJson(request));
    const result = await replaceWeeklyTemplateIdempotently({
      principal,
      input,
      idempotencyKey,
      requestId,
    });

    return apiSuccess(serializeForApi(result), requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

function readIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 200) {
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Envía Idempotency-Key con entre 8 y 200 caracteres",
    );
  }
  return value;
}
