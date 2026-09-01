import { authenticateRequest } from "@/server/auth/principal";
import { apiFailure, apiSuccess, getRequestId } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const principal = authenticateRequest(request, "tracker.read");
    return apiSuccess(
      {
        actorId: principal.actorId,
        trackerUserId: principal.trackerUserId,
        authMethod: principal.authMethod,
        scopes: principal.scopes,
      },
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
