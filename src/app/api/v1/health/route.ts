import { apiFailure, apiSuccess, getRequestId } from "@/server/http/responses";
import { isLocalApiConfigured } from "@/server/auth/principal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    return apiSuccess(
      {
        status: "ok",
        check: "liveness",
        dependenciesChecked: false,
        service: "personal-tracker",
        apiVersion: "v1",
        localAuthConfigured: isLocalApiConfigured(),
        firestoreConfigured: Boolean(
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        ),
        timestamp: new Date().toISOString(),
      },
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
