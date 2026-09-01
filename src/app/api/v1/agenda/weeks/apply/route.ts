import { agendaWeekApplySchema } from "@/contracts/agenda";
import { ApiError, authenticateRequest } from "@/server/auth/principal";
import {
  apiFailure,
  apiSuccess,
  getRequestId,
  readJson,
} from "@/server/http/responses";
import { serializeForApi } from "@/server/http/serialize";
import {
  applyWeeklyTemplateToWeekIdempotently,
  previewWeeklyTemplateApply,
} from "@/server/repositories/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "agenda.write");
    const input = agendaWeekApplySchema.parse(await readJson(request));

    if (input.dryRun) {
      const result = await previewWeeklyTemplateApply(
        principal.trackerUserId,
        input,
      );
      return apiSuccess(serializeForApi(result), requestId);
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (input.expectedWeekRevision === undefined) {
      throw new ApiError(
        422,
        "EXPECTED_WEEK_REVISION_REQUIRED",
        "expectedWeekRevision es obligatorio al aplicar cambios",
      );
    }
    const result = await applyWeeklyTemplateToWeekIdempotently({
      principal,
      input: {
        ...input,
        dryRun: false,
        expectedWeekRevision: input.expectedWeekRevision,
      },
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
