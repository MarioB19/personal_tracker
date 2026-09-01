import {
  expenseCreateSchema,
  normalizeExpenseInput,
} from "@/contracts/expenses";
import { authenticateRequest } from "@/server/auth/principal";
import {
  apiFailure,
  apiSuccess,
  getRequestId,
  readJson,
} from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    authenticateRequest(request, "finance.write");
    const input = expenseCreateSchema.parse(await readJson(request));
    const normalized = normalizeExpenseInput(input);

    return apiSuccess(
      {
        writes: false,
        normalized,
        warnings: normalized.externalRef
          ? []
          : [
              "Añade externalRef cuando el dato provenga de otra nota o sistema para facilitar la deduplicación futura.",
            ],
      },
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
