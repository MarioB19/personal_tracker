export type BusinessHealthStatus = "BIEN" | "ATENCION" | "MAL";

export type BusinessHealthReason =
  | "NO_OPERATION"
  | "NEGATIVE_CONTRIBUTION"
  | "NEGATIVE_RESULT"
  | "HEALTHY";

type BusinessHealthInput = {
  totalRevenue: number;
  totalAdSpend: number;
  netResult: number;
  projectedClosingResult: number;
};

export function classifyBusinessHealth({
  totalRevenue,
  totalAdSpend,
  netResult,
  projectedClosingResult,
}: BusinessHealthInput): {
  status: BusinessHealthStatus;
  reason: BusinessHealthReason;
} {
  const hasOperation = totalRevenue > 0 || totalAdSpend > 0;
  if (!hasOperation) {
    return {
      status: netResult < 0 || projectedClosingResult < 0 ? "MAL" : "ATENCION",
      reason: "NO_OPERATION",
    };
  }

  if (totalRevenue - totalAdSpend <= 0) {
    return { status: "MAL", reason: "NEGATIVE_CONTRIBUTION" };
  }

  if (netResult < 0 || projectedClosingResult < 0) {
    return { status: "ATENCION", reason: "NEGATIVE_RESULT" };
  }

  return { status: "BIEN", reason: "HEALTHY" };
}
