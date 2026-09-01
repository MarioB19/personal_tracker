import { expenseSeriesMutationSchema } from "@/contracts/expenses";
import { ApiError, authenticateRequest } from "@/server/auth/principal";
import {
  apiFailure,
  apiSuccess,
  getRequestId,
  readJson,
} from "@/server/http/responses";
import { serializeForApi } from "@/server/http/serialize";
import {
  IdempotencyConflictError,
  mutateExpenseSeriesIdempotently,
} from "@/server/repositories/finance-expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "finance.write");
    const idempotencyKey = readIdempotencyKey(request);
    const input = expenseSeriesMutationSchema.parse(await readJson(request));
    const result = await mutateExpenseSeriesIdempotently({
      principal,
      input,
      idempotencyKey,
      requestId,
    });

    return apiSuccess(
      {
        replayed: result.replayed,
        deduplicated: result.deduplicated,
        expense: serializeForApi(result.expense),
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return apiFailure(
        new ApiError(409, "IDEMPOTENCY_CONFLICT", error.message),
        requestId,
      );
    }
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
