export type ExpenseSeriesRecord = {
  id: string;
  financialContext?: "PERSONAL" | "BUSINESS";
  type: string;
  frequency?: string;
  name: string;
  productId?: string;
  productName?: string;
  externalRef?: string;
  month: string;
  effectiveFrom?: string;
  seriesId?: string;
  recurrenceStatus?: "ACTIVE" | "CANCELLED";
  subscriptionStatus?: "active" | "cancelled";
  revision?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value !== "object") return 0;
  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if ("seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1_000;
  }
  return 0;
}

function normalizeIdentityPart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("es-MX")
      .replace(/[^a-z0-9]+/g, "") || "sinconcepto"
  );
}

function isMonthlyRecurringIdentityRecord(
  expense: Pick<ExpenseSeriesRecord, "type" | "frequency">,
) {
  return (
    (expense.type === "FIJO" || expense.type === "SUSCRIPCION") &&
    (!expense.frequency || expense.frequency === "MENSUAL")
  );
}

// cyrb128: deterministic 128-bit non-cryptographic hash. It keeps legacy
// identifiers bounded and free of control characters in browser and server.
function stableIdentityHash(value: string) {
  let h1 = 1_779_033_703;
  let h2 = 3_144_134_277;
  let h3 = 1_013_904_242;
  let h4 = 2_773_480_762;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597_399_067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2_869_860_233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951_274_213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2_716_044_179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597_399_067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2_869_860_233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951_274_213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2_716_044_179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1, h2, h3, h4]
    .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/** Stable identity used to adopt unversioned recurring expenses. */
export function canonicalExpenseSeriesId(
  expense: Pick<
    ExpenseSeriesRecord,
    | "financialContext"
    | "type"
    | "name"
    | "productId"
    | "productName"
    | "externalRef"
  >,
) {
  if (expense.externalRef) {
    const identity = [
      expense.financialContext || "PERSONAL",
      expense.type,
      "external",
      expense.externalRef,
    ].join(":");
    return `expense:external:${stableIdentityHash(identity)}`;
  }

  const identity = [
    expense.financialContext || "PERSONAL",
    expense.type,
    normalizeIdentityPart(expense.name),
    expense.productId || normalizeIdentityPart(expense.productName || ""),
  ].join(":");
  const readable = `legacy:${identity}`;
  return readable.length <= 240 && !/[\u0000-\u001F\u007F]/.test(readable)
    ? readable
    : `expense:${stableIdentityHash(identity)}`;
}

/** Canonical lock identity for the dedicated Health Check fixed ledger. */
export function canonicalInfoproductFixedIdentity(concept: string) {
  return `infoproduct-fixed:${normalizeIdentityPart(concept)}`;
}

export function isNewerExpenseVersion<T extends ExpenseSeriesRecord>(
  candidate: T,
  current: T | undefined,
) {
  if (!current) return true;
  const candidateExplicit = Boolean(
    candidate.seriesId ||
      candidate.effectiveFrom ||
      candidate.recurrenceStatus ||
      typeof candidate.revision === "number",
  );
  const currentExplicit = Boolean(
    current.seriesId ||
      current.effectiveFrom ||
      current.recurrenceStatus ||
      typeof current.revision === "number",
  );
  if (candidateExplicit !== currentExplicit) return candidateExplicit;

  const candidateRevision = candidate.revision || 0;
  const currentRevision = current.revision || 0;
  if (candidateRevision !== currentRevision) {
    return candidateRevision > currentRevision;
  }

  const candidateTimestamp =
    timestampMillis(candidate.updatedAt) || timestampMillis(candidate.createdAt);
  const currentTimestamp =
    timestampMillis(current.updatedAt) || timestampMillis(current.createdAt);
  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp;
  }

  const candidateFrom = candidate.effectiveFrom || candidate.month;
  const currentFrom = current.effectiveFrom || current.month;
  return (
    candidateFrom > currentFrom ||
    (candidateFrom === currentFrom && candidate.id > current.id)
  );
}

export function latestRecurringExpensesBySeries<T extends ExpenseSeriesRecord>(
  expenses: T[],
) {
  const latest = new Map<string, T>();
  expenses.forEach((expense) => {
    const seriesId = expense.seriesId || canonicalExpenseSeriesId(expense);
    const current = latest.get(seriesId);
    if (isNewerExpenseVersion(expense, current)) latest.set(seriesId, expense);
  });
  return latest;
}

function nextAvailableSeriesId(
  canonicalId: string,
  occupiedSeriesIds: ReadonlySet<string>,
) {
  if (!occupiedSeriesIds.has(canonicalId)) return canonicalId;

  for (
    let generation = 1;
    generation <= occupiedSeriesIds.size + 1;
    generation += 1
  ) {
    const candidate = `expense:${stableIdentityHash(`${canonicalId}:generation:${generation}`)}`;
    if (!occupiedSeriesIds.has(candidate)) return candidate;
  }

  throw new Error("No fue posible asignar una serie independiente al gasto");
}

export function selectExpenseSeriesForIdentity<T extends ExpenseSeriesRecord>(
  records: T[],
  input: Pick<
    ExpenseSeriesRecord,
    | "financialContext"
    | "type"
    | "name"
    | "productId"
    | "productName"
    | "externalRef"
  >,
) {
  const canonicalId = canonicalExpenseSeriesId(input);
  const currentBySeries = latestRecurringExpensesBySeries(records);
  const identitySeenHistorically = records.some(
    (expense) => canonicalExpenseSeriesId(expense) === canonicalId,
  );
  const seed = Array.from(currentBySeries.values()).reduce<T | undefined>(
    (latest, expense) => {
      if (canonicalExpenseSeriesId(expense) !== canonicalId) return latest;
      return isNewerExpenseVersion(expense, latest) ? expense : latest;
    },
    undefined,
  );
  const activeSeed =
    seed?.recurrenceStatus === "CANCELLED" ||
    (seed?.type === "SUSCRIPCION" &&
      seed?.subscriptionStatus === "cancelled")
      ? undefined
      : seed;

  return {
    seed: activeSeed,
    identitySeenHistorically,
    seriesId:
      activeSeed?.seriesId ||
      (activeSeed
        ? canonicalExpenseSeriesId(activeSeed)
        : nextAvailableSeriesId(canonicalId, new Set(currentBySeries.keys()))),
  };
}

export function findCurrentExpenseBySeriesId<T extends ExpenseSeriesRecord>(
  records: T[],
  seriesId: string,
) {
  return latestRecurringExpensesBySeries(records).get(seriesId);
}

export function findActiveExpenseIdentityConflict<
  T extends ExpenseSeriesRecord,
>(
  records: T[],
  input: Pick<
    ExpenseSeriesRecord,
    | "financialContext"
    | "type"
    | "name"
    | "productId"
    | "productName"
    | "externalRef"
  >,
  excludedSeriesId: string,
) {
  const identity = canonicalExpenseSeriesId(input);
  const monthlyRecords = records.filter(isMonthlyRecurringIdentityRecord);
  for (const [seriesId, expense] of latestRecurringExpensesBySeries(monthlyRecords)) {
    if (seriesId === excludedSeriesId) continue;
    if (
      expense.recurrenceStatus === "CANCELLED" ||
      (expense.type === "SUSCRIPCION" &&
        expense.subscriptionStatus === "cancelled")
    ) {
      continue;
    }
    if (canonicalExpenseSeriesId(expense) === identity) {
      return { seriesId, expense };
    }
  }
  return undefined;
}
