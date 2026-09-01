import {
  AGENDA_TIME_ZONE,
  normalizeTemplateSlots,
  summarizeWeeklyTemplate,
  weeklyTemplatePreviewSchema,
} from "@/contracts/agenda";
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
    authenticateRequest(request, "agenda.write");
    const input = weeklyTemplatePreviewSchema.parse(await readJson(request));
    const slots = normalizeTemplateSlots(input.slots);

    return apiSuccess(
      {
        writes: false,
        normalized: {
          timezone: AGENDA_TIME_ZONE,
          slots,
        },
        summary: summarizeWeeklyTemplate(slots),
      },
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
