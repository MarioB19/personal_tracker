import { z } from "zod";
import { monthSchema } from "@/contracts/expenses";
import { authenticateRequest } from "@/server/auth/principal";
import { apiFailure, apiSuccess, getRequestId } from "@/server/http/responses";
import {
  currentMonthInMexicoCity,
  getDashboardSummary,
} from "@/server/services/dashboard-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  month: monthSchema.optional(),
  financialContext: z.enum(["ALL", "PERSONAL", "BUSINESS"]).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "tracker.read");
    const url = new URL(request.url);
    const query = querySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const month = query.month ?? currentMonthInMexicoCity();
    const summary = await getDashboardSummary(
      principal.trackerUserId,
      month,
      query.financialContext ?? "ALL",
    );
    return apiSuccess(summary, requestId);
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
