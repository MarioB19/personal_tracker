import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/server/auth/principal";

export function getRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9_-]{8,100}$/.test(supplied)
    ? supplied
    : `req_${randomUUID()}`;
}

export function apiSuccess(
  data: unknown,
  requestId: string,
  status = 200,
) {
  return NextResponse.json(
    {
      data,
      meta: { requestId, apiVersion: "v1" },
    },
    { status },
  );
}

export function apiFailure(error: unknown, requestId: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
          requestId,
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.status },
    );
  }

  console.error(`[personal-tracker-api:${requestId}]`, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error interno",
        requestId,
      },
    },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "El cuerpo no contiene JSON válido");
  }
}
