import {
  expenseCreateSchema,
  expenseListQuerySchema,
  normalizeExpenseInput,
} from "@/contracts/expenses";
import { ApiError, authenticateRequest } from "@/server/auth/principal";
import {
  apiFailure,
  apiSuccess,
  getRequestId,
  readJson,
} from "@/server/http/responses";
import { serializeForApi } from "@/server/http/serialize";
import {
  createExpenseIdempotently,
  IdempotencyConflictError,
  listExpenses,
} from "@/server/repositories/finance-expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "finance.read");
    const url = new URL(request.url);
    const filters = expenseListQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const expenses = await listExpenses(principal.trackerUserId, filters);

    return apiSuccess(
      {
        items: serializeForApi(expenses),
        count: expenses.length,
        filters,
      },
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "finance.write");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();

    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ApiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Envía Idempotency-Key con entre 8 y 200 caracteres",
      );
    }

    const input = expenseCreateSchema.parse(await readJson(request));
    const result = await createExpenseIdempotently({
      principal,
      input: normalizeExpenseInput(input),
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
      result.replayed || result.deduplicated ? 200 : 201,
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
