import type {
  Expense,
  FinancialContext,
  Income,
  InfoproductFixedExpense,
} from "@/lib/types";
import type { VibeBusinessSummary } from "@/contracts/vibe-business";
import { canonicalExpenseSeriesId } from "./expense-series.ts";

export type ResolvedRecurringFixedExpense = InfoproductFixedExpense & {
  resolvedSeriesId: string;
  resolvedEffectiveFrom: string;
};

export type MonthlyBusinessResult = {
  month: string;
  netResult: number;
  hasData: boolean;
};

export type BusinessPositionStatus =
  | "UNKNOWN"
  | "SUSTAINABLE"
  | "CRITICAL"
  | "ATTENTION"
  | "HEALTHY";

export type BusinessBurnSource =
  | "TRAILING_AVERAGE"
  | "CURRENT_PROJECTION"
  | "FIXED_COMMITMENT"
  | "NONE";

export type BusinessPositionInput = {
  availableCash: number;
  cashConfigured?: boolean;
  closedMonths: MonthlyBusinessResult[];
  currentProjection?: MonthlyBusinessResult;
  currentFixedCommitment: number;
  productTestCost: number;
  reserveMonths?: number;
};

export type BusinessPosition = {
  availableCash: number;
  cashConfigured: boolean;
  monthlyBurn: number | null;
  runwayMonths: number | null;
  status: BusinessPositionStatus;
  burnSource: BusinessBurnSource;
  sampleMonths: number;
  reserveAmount: number;
  capitalAvailableForTests: number;
  possibleTests: number;
};

export type ExpenseRecurrenceRecord = {
  id: string;
  name: string;
  amount: number;
  category: Expense["category"];
  type: Expense["type"];
  frequency?: Expense["frequency"];
  month: string;
  financialContext?: Expense["financialContext"];
  productId?: string;
  productName?: string;
  externalRef?: string;
  chargeDay?: number;
  subscriptionStatus?: Expense["subscriptionStatus"];
  effectiveFrom?: string;
  seriesId?: string;
  recurrenceStatus?: "ACTIVE" | "CANCELLED";
  revision?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type IncomeRecurrenceRecord = {
  id?: string;
  source?: string;
  type?: Income["type"];
  month?: string;
  date?: string;
  frequency?: Income["frequency"];
  financialContext?: Income["financialContext"];
  productId?: string;
  productName?: string;
  effectiveFrom?: string;
  seriesId?: string;
  recurrenceStatus?: "ACTIVE" | "CANCELLED";
  revision?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function declaredIncomeMonthKey(
  income: Pick<IncomeRecurrenceRecord, "month" | "date">,
): string | null {
  if (income.month && MONTH_KEY_PATTERN.test(income.month)) {
    return income.month;
  }

  const dateMonth = income.date?.slice(0, 7);
  return dateMonth && MONTH_KEY_PATTERN.test(dateMonth) ? dateMonth : null;
}

function effectiveIncomeMonthKey(
  income: Pick<IncomeRecurrenceRecord, "effectiveFrom" | "month" | "date">,
): string | null {
  if (
    income.effectiveFrom &&
    MONTH_KEY_PATTERN.test(income.effectiveFrom)
  ) {
    return income.effectiveFrom;
  }
  return declaredIncomeMonthKey(income);
}

function incomeFinancialContext(
  income: Pick<IncomeRecurrenceRecord, "financialContext">,
): FinancialContext {
  return income.financialContext === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

export function canonicalRecurringIncomeIdentity(
  income: IncomeRecurrenceRecord,
): string {
  const productIdentity = income.productId?.trim()
    ? `id:${income.productId.trim()}`
    : `name:${normalizeConcept(income.productName || "")}`;
  return `income:${JSON.stringify([
    incomeFinancialContext(income),
    normalizeConcept(income.source || ""),
    income.type || "OTRO",
    productIdentity,
  ])}`;
}

export function recurringIncomeIdentityMatches(
  current: IncomeRecurrenceRecord,
  requested: IncomeRecurrenceRecord,
): boolean {
  return (
    canonicalRecurringIncomeIdentity(current) ===
    canonicalRecurringIncomeIdentity(requested)
  );
}

export function recurringIncomeSeriesId(
  income: IncomeRecurrenceRecord,
): string {
  const explicitSeriesId = income.seriesId?.trim();
  return explicitSeriesId || canonicalRecurringIncomeIdentity(income);
}

export function nextRecurringIncomeRevision(previousRevision?: number): number {
  return typeof previousRevision === "number" &&
    Number.isSafeInteger(previousRevision) &&
    previousRevision >= 0
    ? previousRevision + 1
    : 1;
}

export type RecurringIncomeWriteDecision = {
  previousRevision: number;
  mode: "CREATE" | "APPEND_LEGACY" | "APPEND" | "REACTIVATE";
};

/**
 * Decides a recurring-income write without touching Firestore. A null expected
 * revision means a user is creating a new monthly source: it may create a new
 * state or reactivate a cancelled one, but it must never join an active state.
 */
export function decideRecurringIncomeWrite(
  state: { revision?: unknown; status?: unknown } | null,
  expectedRevision: number | null,
  requestedStatus: "ACTIVE" | "CANCELLED",
): RecurringIncomeWriteDecision | null {
  const validExpectedRevision =
    expectedRevision === null ||
    (Number.isSafeInteger(expectedRevision) &&
      expectedRevision >= 0 &&
      expectedRevision < Number.MAX_SAFE_INTEGER);
  if (!validExpectedRevision) return null;

  if (!state) {
    if (expectedRevision === null) {
      return requestedStatus === "ACTIVE"
        ? { previousRevision: 0, mode: "CREATE" }
        : null;
    }
    return expectedRevision === 0
      ? { previousRevision: 0, mode: "APPEND_LEGACY" }
      : null;
  }

  const storedRevision = state.revision;
  const storedStatus = state.status;
  if (
    !Number.isSafeInteger(storedRevision) ||
    (storedRevision as number) < 0 ||
    (storedRevision as number) >= Number.MAX_SAFE_INTEGER ||
    (storedStatus !== "ACTIVE" && storedStatus !== "CANCELLED")
  ) {
    return null;
  }

  if (expectedRevision === null) {
    return storedStatus === "CANCELLED" && requestedStatus === "ACTIVE"
      ? {
          previousRevision: storedRevision as number,
          mode: "REACTIVATE",
        }
      : null;
  }

  if (storedStatus !== "ACTIVE" || storedRevision !== expectedRevision) {
    return null;
  }
  return { previousRevision: storedRevision as number, mode: "APPEND" };
}

export type IncomeLifecycleAction =
  | "CREATE_RECURRING"
  | "APPEND_RECURRING"
  | "CREATE_ONE_OFF"
  | "UPDATE_ONE_OFF"
  | "REJECT_FREQUENCY_CHANGE";

export function incomeLifecycleAction(
  existingFrequency: Income["frequency"] | null,
  requestedFrequency: Income["frequency"],
): IncomeLifecycleAction {
  if (
    existingFrequency !== null &&
    existingFrequency !== requestedFrequency
  ) {
    return "REJECT_FREQUENCY_CHANGE";
  }
  if (requestedFrequency === "MENSUAL") {
    return existingFrequency === null
      ? "CREATE_RECURRING"
      : "APPEND_RECURRING";
  }
  return existingFrequency === null ? "CREATE_ONE_OFF" : "UPDATE_ONE_OFF";
}

export function incomeRemovalAction(
  frequency: Income["frequency"],
): "APPEND_CANCELLATION" | "DELETE_ONE_OFF" {
  return frequency === "MENSUAL"
    ? "APPEND_CANCELLATION"
    : "DELETE_ONE_OFF";
}

type IncomeVersionCandidate<T extends IncomeRecurrenceRecord> = {
  income: T;
  index: number;
  effectiveFrom: string;
  revision: number;
  timestamp: number;
  id: string;
};

function newerIncomeVersion<T extends IncomeRecurrenceRecord>(
  candidate: IncomeVersionCandidate<T>,
  current: IncomeVersionCandidate<T>,
): boolean {
  if (candidate.effectiveFrom !== current.effectiveFrom) {
    return candidate.effectiveFrom > current.effectiveFrom;
  }
  if (candidate.revision !== current.revision) {
    return candidate.revision > current.revision;
  }
  if (candidate.timestamp !== current.timestamp) {
    return candidate.timestamp > current.timestamp;
  }
  return candidate.id > current.id;
}

/**
 * Resolves income records without mutating or materializing Firestore data.
 * Only explicitly monthly income recurs. Monthly captures with the same
 * stable identity are versions of one source, so a later capture replaces the
 * previous amount instead of accumulating forever. Every other cadence remains
 * an independent record tied to its declared month.
 */
export function resolveIncomesForMonth<T extends IncomeRecurrenceRecord>(
  incomes: T[],
  targetMonth: string,
  financialContext?: FinancialContext,
): T[] {
  if (!MONTH_KEY_PATTERN.test(targetMonth)) return [];

  const oneOff: Array<{ income: T; index: number }> = [];
  const recurring = new Map<string, IncomeVersionCandidate<T>>();

  incomes.forEach((income, index) => {
    if (income.frequency !== "MENSUAL") {
      const declaredMonth = declaredIncomeMonthKey(income);
      if (
        declaredMonth === targetMonth &&
        (!financialContext ||
          incomeFinancialContext(income) === financialContext)
      ) {
        oneOff.push({ income, index });
      }
      return;
    }

    const effectiveFrom = effectiveIncomeMonthKey(income);
    if (!effectiveFrom || effectiveFrom > targetMonth) return;

    const candidate: IncomeVersionCandidate<T> = {
      income,
      index,
      effectiveFrom,
      revision:
        typeof income.revision === "number" && Number.isFinite(income.revision)
          ? income.revision
          : 0,
      timestamp:
        timestampMillis(income.updatedAt) || timestampMillis(income.createdAt),
      id: income.id || "",
    };
    const seriesId = recurringIncomeSeriesId(income);
    const current = recurring.get(seriesId);
    if (!current || newerIncomeVersion(candidate, current)) {
      recurring.set(seriesId, candidate);
    }
  });

  const activeRecurring = Array.from(recurring.values())
    .filter(
      (candidate) =>
        candidate.income.recurrenceStatus !== "CANCELLED" &&
        (!financialContext ||
          incomeFinancialContext(candidate.income) === financialContext),
    );

  return [...oneOff, ...activeRecurring]
    .sort((left, right) => left.index - right.index)
    .map((candidate) => candidate.income);
}

export function isVibeBusinessSummaryComplete(
  summary: Pick<VibeBusinessSummary, "status" | "quality">,
): boolean {
  if (summary.status !== "FINAL") return false;

  const expectedSources = new Set(["meta", "clicchat", "platform"]);
  const seenSources = new Set<string>();
  const hasInvalidSource = summary.quality.sources.some((source) => {
    if (!expectedSources.has(source.id) || seenSources.has(source.id)) {
      return true;
    }
    seenSources.add(source.id);
    return source.status !== "connected" && source.status !== "empty";
  });
  const hasBlockingCheck = summary.quality.checks.some(
    (check) => check.status === "ERROR",
  );
  const expectedCheckCodes = new Set([
    "CHECK_1",
    "CHECK_2",
    "CHECK_3",
    "CHECK_4",
    "CHECK_5",
  ]);
  const checkCodes = new Set(summary.quality.checks.map((check) => check.code));
  const hasCompleteChecks =
    summary.quality.checks.length === expectedCheckCodes.size &&
    checkCodes.size === expectedCheckCodes.size &&
    Array.from(expectedCheckCodes).every((code) => checkCodes.has(code));

  return (
    !hasInvalidSource &&
    seenSources.size === expectedSources.size &&
    hasCompleteChecks &&
    !hasBlockingCheck
  );
}

export function nonNegativeExpenseAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function isMonthlyRecurringExpense(
  expense: Pick<ExpenseRecurrenceRecord, "type" | "frequency">,
): boolean {
  return (
    (expense.type === "FIJO" || expense.type === "SUSCRIPCION") &&
    (!expense.frequency || expense.frequency === "MENSUAL")
  );
}

export function businessExpenseAppliesToMonth(
  expense: Pick<
    ExpenseRecurrenceRecord,
    | "month"
    | "effectiveFrom"
    | "type"
    | "frequency"
    | "subscriptionStatus"
    | "recurrenceStatus"
  >,
  targetMonth: string,
): boolean {
  const from = expense.effectiveFrom || expense.month;
  if (!from || from > targetMonth) return false;
  if (expense.recurrenceStatus === "CANCELLED") return false;
  if (
    expense.type === "SUSCRIPCION" &&
    expense.subscriptionStatus === "cancelled"
  ) {
    return false;
  }

  const isMonthlyCommitment = isMonthlyRecurringExpense(expense);

  return isMonthlyCommitment || expense.month === targetMonth;
}

export function normalizeConcept(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, "") || "sinconcepto";
}

export function recurringFixedSeriesId(expense: InfoproductFixedExpense): string {
  return expense.seriesId?.trim() || `legacy:${normalizeConcept(expense.concept)}`;
}

export function recurringFixedEffectiveFrom(expense: InfoproductFixedExpense): string {
  return expense.effectiveFrom || expense.month;
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== "object") return 0;

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if ("seconds" in value && typeof value.seconds === "number") {
    const nanoseconds =
      "nanoseconds" in value && typeof value.nanoseconds === "number"
        ? value.nanoseconds
        : 0;
    return value.seconds * 1_000 + nanoseconds / 1_000_000;
  }

  return 0;
}

export function recurringBusinessExpenseSeriesId(
  expense: ExpenseRecurrenceRecord,
): string {
  return expense.seriesId?.trim() || canonicalExpenseSeriesId(expense);
}

function recurringBusinessExpenseEffectiveFrom(
  expense: ExpenseRecurrenceRecord,
): string {
  return expense.effectiveFrom || expense.month;
}

/**
 * Resolves the expenses that apply to a target month.
 *
 * Monthly fixed expenses and subscriptions remain active from their start
 * month. Legacy copies with the same normalized identity are treated as
 * versions, so only the latest applicable document is counted. Other
 * frequencies remain tied to their declared month until their cadence has a
 * dedicated model.
 */
export function resolveExpensesForMonth<T extends ExpenseRecurrenceRecord>(
  expenses: T[],
  targetMonth: string,
): T[] {
  const oneOff: T[] = [];
  const recurring = new Map<
    string,
    {
      expense: T;
      from: string;
      rank: VersionRank;
      explicit: boolean;
    }
  >();

  expenses.forEach((expense) => {
    if (!expense.month) return;

    if (!isMonthlyRecurringExpense(expense)) {
      if (
        expense.month === targetMonth &&
        expense.recurrenceStatus !== "CANCELLED" &&
        (expense.type !== "SUSCRIPCION" ||
          expense.subscriptionStatus !== "cancelled")
      ) {
        oneOff.push(expense);
      }
      return;
    }

    const from = recurringBusinessExpenseEffectiveFrom(expense);
    if (!from || from > targetMonth) return;

    const seriesKey = recurringBusinessExpenseSeriesId(expense);
    const candidate = {
      expense,
      from,
      rank: {
        revision:
          typeof expense.revision === "number" &&
          Number.isFinite(expense.revision)
            ? expense.revision
            : 0,
        timestamp:
          timestampMillis(expense.updatedAt) ||
          timestampMillis(expense.createdAt),
      },
      explicit: Boolean(
        expense.seriesId ||
          expense.effectiveFrom ||
          expense.recurrenceStatus ||
          typeof expense.revision === "number",
      ),
    };
    const current = recurring.get(seriesKey);
    const wins =
      !current ||
      (candidate.explicit && !current.explicit) ||
      (candidate.explicit &&
        current.explicit &&
        (isNewerVersion(candidate.rank, current.rank) ||
          (!isNewerVersion(current.rank, candidate.rank) &&
            candidate.from > current.from))) ||
      (!candidate.explicit &&
        !current.explicit &&
        (candidate.from > current.from ||
          (candidate.from === current.from &&
            (isNewerVersion(candidate.rank, current.rank) ||
              (!isNewerVersion(current.rank, candidate.rank) &&
                candidate.expense.id > current.expense.id)))));

    if (wins) recurring.set(seriesKey, candidate);
  });

  const activeRecurring = Array.from(recurring.values())
    .map((candidate) => candidate.expense)
    .filter(
      (expense) =>
        expense.recurrenceStatus !== "CANCELLED" &&
        (expense.type !== "SUSCRIPCION" ||
          expense.subscriptionStatus !== "cancelled"),
    );

  return [...oneOff, ...activeRecurring]
    .map((expense) => ({
      ...expense,
      amount: nonNegativeExpenseAmount(expense.amount),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
}

export function resolveCombinedBusinessFixedExpenses(
  fixedExpenses: InfoproductFixedExpense[],
  businessExpenses: Expense[],
  targetMonth: string,
) {
  const resolvedVersions = resolveRecurringFixedExpenseVersions(
    fixedExpenses,
    targetMonth,
  );
  const versioned = resolvedVersions.filter(
    (expense) => expense.status !== "CANCELLED",
  );
  const currentVersionBySeries = new Map(
    resolvedVersions.map((expense) => [expense.resolvedSeriesId, expense]),
  );
  const versionedByConcept = new Map<
    string,
    Map<
      string,
      {
        currentVersion: ResolvedRecurringFixedExpense;
        firstAliasFrom: string;
      }
    >
  >();
  fixedExpenses.forEach((expense) => {
    const from = recurringFixedEffectiveFrom(expense);
    if (!from || from > targetMonth) return;
    const seriesId = recurringFixedSeriesId(expense);
    const currentVersion = currentVersionBySeries.get(seriesId);
    if (!currentVersion) return;
    const concept = normalizeConcept(expense.concept);
    const owners = versionedByConcept.get(concept) || new Map();
    const existingOwner = owners.get(seriesId);
    owners.set(seriesId, {
      currentVersion,
      firstAliasFrom:
        !existingOwner || from < existingOwner.firstAliasFrom
          ? from
          : existingOwner.firstAliasFrom,
    });
    versionedByConcept.set(concept, owners);
  });
  const resolvedBusinessExpenses = resolveExpensesForMonth(
    businessExpenses,
    targetMonth,
  ).filter(
    (expense) => (expense.financialContext || "PERSONAL") === "BUSINESS",
  );
  const general = resolvedBusinessExpenses.filter(
    (expense) => {
      if (
        !isMonthlyRecurringExpense(expense)
      ) {
        return false;
      }

      // An explicit external identity represents a real independent
      // commitment. The Health Check ledger has no externalRef with which to
      // prove it is the same bill, so a name-only match must not suppress it.
      if (expense.externalRef) return true;

      const canonicalOwners = versionedByConcept.get(
        normalizeConcept(expense.name),
      );
      if (!canonicalOwners?.size) return true;
      const genericFrom = recurringBusinessExpenseEffectiveFrom(expense);
      const explicitGeneric = Boolean(
        expense.seriesId ||
          expense.effectiveFrom ||
          expense.recurrenceStatus ||
          typeof expense.revision === "number",
      );
      if (!explicitGeneric) return false;

      // An alias is released whenever its canonical series is currently
      // renamed or stopped. A genuinely newer explicit generic series can
      // resume after any later release; unversioned/older copies stay
      // suppressed as legacy duplicates.
      return Array.from(canonicalOwners.values()).every((owner) => {
        const currentOwnsConcept =
          normalizeConcept(owner.currentVersion.concept) ===
          normalizeConcept(expense.name);
        if (
          currentOwnsConcept &&
          owner.currentVersion.status !== "CANCELLED"
        ) {
          return false;
        }
        return genericFrom > owner.firstAliasFrom;
      });
    },
  );
  const periodOnly = resolvedBusinessExpenses.filter(
    (expense) => !isMonthlyRecurringExpense(expense),
  );

  return { versioned, general, periodOnly };
}

type VersionRank = {
  revision: number;
  timestamp: number;
};

function versionRank(expense: InfoproductFixedExpense): VersionRank {
  return {
    // Revisions are intentionally kept separate from epoch milliseconds.
    // Mixing both in one number made a new revision (for example, 2) lose
    // against a legacy Firestore timestamp (for example, 1_700_000_000_000).
    revision:
      typeof expense.revision === "number" && Number.isFinite(expense.revision)
        ? expense.revision
        : 0,
    timestamp:
      timestampMillis(expense.updatedAt) || timestampMillis(expense.createdAt),
  };
}

function isNewerVersion(candidate: VersionRank, current: VersionRank): boolean {
  if (candidate.revision !== current.revision) {
    return candidate.revision > current.revision;
  }

  return candidate.timestamp > current.timestamp;
}

/**
 * Resolves one effective version per recurring expense series for a month.
 *
 * Legacy documents are grouped by normalized concept. This makes the old
 * "copy previous month" snapshots behave as one recurrence instead of being
 * accumulated as duplicates.
 */
function resolveRecurringFixedExpenseVersions(
  expenses: InfoproductFixedExpense[],
  targetMonth: string,
): ResolvedRecurringFixedExpense[] {
  const effective = new Map<
    string,
    {
      expense: InfoproductFixedExpense;
      from: string;
      rank: VersionRank;
      explicit: boolean;
    }
  >();

  expenses.forEach((expense) => {
    const from = recurringFixedEffectiveFrom(expense);
    if (!from || from > targetMonth) return;

    const seriesId = recurringFixedSeriesId(expense);
    const candidate = {
      expense,
      from,
      rank: versionRank(expense),
      explicit: Boolean(
        expense.seriesId ||
          expense.effectiveFrom ||
          expense.status ||
          typeof expense.revision === "number",
      ),
    };
    const current = effective.get(seriesId);

    const wins =
      !current ||
      (candidate.explicit && !current.explicit) ||
      (candidate.explicit &&
        current.explicit &&
        (isNewerVersion(candidate.rank, current.rank) ||
          (!isNewerVersion(current.rank, candidate.rank) &&
            candidate.from > current.from))) ||
      (!candidate.explicit &&
        !current.explicit &&
        (candidate.from > current.from ||
          (candidate.from === current.from &&
            isNewerVersion(candidate.rank, current.rank))));

    if (wins) effective.set(seriesId, candidate);
  });

  return Array.from(effective.entries())
    .map(([seriesId, candidate]) => ({
      ...candidate.expense,
      resolvedSeriesId: seriesId,
      resolvedEffectiveFrom: candidate.from,
    }))
    .sort((a, b) => a.concept.localeCompare(b.concept, "es-MX"));
}

export function resolveRecurringFixedExpenses(
  expenses: InfoproductFixedExpense[],
  targetMonth: string,
): ResolvedRecurringFixedExpense[] {
  return resolveRecurringFixedExpenseVersions(expenses, targetMonth).filter(
    (expense) => expense.status !== "CANCELLED",
  );
}

export function totalRecurringFixedExpenses(
  expenses: InfoproductFixedExpense[],
  targetMonth: string,
): number {
  return resolveRecurringFixedExpenses(expenses, targetMonth).reduce(
    (sum, expense) => sum + Math.max(0, expense.amount || 0),
    0,
  );
}

export function totalRecurringFixedExpensesForMonths(
  expenses: InfoproductFixedExpense[],
  monthKeys: string[],
): number {
  return monthKeys.reduce(
    (sum, month) => sum + totalRecurringFixedExpenses(expenses, month),
    0,
  );
}

export function addMonthsToMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calculateBusinessPosition({
  availableCash,
  cashConfigured = true,
  closedMonths,
  currentProjection,
  currentFixedCommitment,
  productTestCost,
  reserveMonths = 3,
}: BusinessPositionInput): BusinessPosition {
  const cash = Number.isFinite(availableCash) ? availableCash : 0;
  const fixedCommitment = Math.max(0, currentFixedCommitment || 0);
  const closedSample = closedMonths
    .filter((month) => month.hasData && Number.isFinite(month.netResult))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-3);

  let monthlyBurn: number | null = null;
  let burnSource: BusinessBurnSource = "NONE";

  const projectedBurn =
    currentProjection?.hasData && Number.isFinite(currentProjection.netResult)
      ? Math.max(0, -currentProjection.netResult)
      : null;

  if (closedSample.length > 0) {
    const averageNet =
      closedSample.reduce((sum, month) => sum + month.netResult, 0) /
      closedSample.length;
    monthlyBurn = Math.max(0, -averageNet);
    burnSource = "TRAILING_AVERAGE";

    // A sharp deterioration in the open month should not be hidden by an old
    // profitable average. The more conservative observed burn wins.
    if (projectedBurn !== null && projectedBurn > monthlyBurn) {
      monthlyBurn = projectedBurn;
      burnSource = "CURRENT_PROJECTION";
    }
  } else if (projectedBurn !== null) {
    monthlyBurn = projectedBurn;
    burnSource = "CURRENT_PROJECTION";
  } else if (fixedCommitment > 0) {
    monthlyBurn = fixedCommitment;
    burnSource = "FIXED_COMMITMENT";
  }

  // When the open month is not trustworthy yet, new fixed commitments are the
  // safest observable floor. This prevents an old profitable close from
  // presenting the business as sustainable while current obligations consume
  // cash.
  if (
    !currentProjection?.hasData &&
    fixedCommitment > 0 &&
    (monthlyBurn === null || fixedCommitment > monthlyBurn)
  ) {
    monthlyBurn = fixedCommitment;
    burnSource = "FIXED_COMMITMENT";
  }

  let status: BusinessPositionStatus = "UNKNOWN";
  let runwayMonths: number | null = null;

  if (!cashConfigured) {
    status = "UNKNOWN";
  } else if (cash <= 0) {
    status = "CRITICAL";
    runwayMonths = 0;
  } else if (monthlyBurn !== null) {
    if (monthlyBurn === 0) {
      status = "SUSTAINABLE";
    } else {
      runwayMonths = Math.max(0, cash) / monthlyBurn;
      status =
        runwayMonths < 3
          ? "CRITICAL"
          : runwayMonths < 6
            ? "ATTENTION"
            : "HEALTHY";
    }
  }

  const normalizedReserveMonths = Number.isFinite(reserveMonths)
    ? Math.max(0, reserveMonths)
    : 3;
  const reserveAmount = fixedCommitment * normalizedReserveMonths;
  const capitalAvailableForTests = cashConfigured
    ? Math.max(0, cash - reserveAmount)
    : 0;
  const normalizedTestCost = productTestCost > 0 ? productTestCost : 1_000;

  return {
    availableCash: cash,
    cashConfigured,
    monthlyBurn,
    runwayMonths,
    status,
    burnSource,
    sampleMonths: closedSample.length,
    reserveAmount,
    capitalAvailableForTests,
    possibleTests: Math.floor(capitalAvailableForTests / normalizedTestCost),
  };
}
