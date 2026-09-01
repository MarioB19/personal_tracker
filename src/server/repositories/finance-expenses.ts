import { createHash } from "node:crypto";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type {
  ExpenseApiRecord,
  ExpenseListQuery,
  NormalizedExpenseInput,
  ExpenseSeriesMutationInput,
} from "@/contracts/expenses";
import {
  expenseRecurrenceStatus,
  expenseApiRecordSchema,
  nextExpenseSeriesRevision,
  normalizeExpenseInput,
} from "@/contracts/expenses";
import { ApiError, type Principal } from "@/server/auth/principal";
import { resolveExpensesForMonth } from "@/lib/finance/business-metrics";
import { monthInMexicoCity } from "@/lib/time/month";
import {
  canonicalExpenseSeriesId,
  findActiveExpenseIdentityConflict,
  findCurrentExpenseBySeriesId,
  isNewerExpenseVersion,
  selectExpenseSeriesForIdentity,
} from "@/lib/finance/expense-series";

const IDEMPOTENCY_OPERATION = "v1:finance.expenses.create";
const SERIES_MUTATION_OPERATION = "v1:finance.expenses.series.mutate";
const IDEMPOTENCY_TTL_MS = 90 * 24 * 60 * 60 * 1_000;

export class IdempotencyConflictError extends Error {
  constructor() {
    super("La llave de idempotencia ya fue usada con otros datos");
    this.name = "IdempotencyConflictError";
  }
}

function expensesCollection(userId: string) {
  return collection(db, "users", userId, "finance", "data", "expenses");
}

function expenseSeriesCollection(userId: string) {
  return collection(db, "users", userId, "finance", "data", "expenseSeries");
}

function expenseSeriesRef(userId: string, seriesId: string) {
  const key = createHash("sha256").update(seriesId).digest("hex");
  return doc(expenseSeriesCollection(userId), key);
}

function expenseIdentityClaimRef(userId: string, identity: string) {
  const key = createHash("sha256").update(identity).digest("hex");
  return doc(
    db,
    "users",
    userId,
    "finance",
    "data",
    "expenseIdentityClaims",
    key,
  );
}

function idempotencyRef(
  userId: string,
  operation: string,
  idempotencyKey: string,
) {
  const key = createHash("sha256")
    .update(`${userId}:${operation}:${idempotencyKey}`)
    .digest("hex");
  return doc(db, "users", userId, "apiIdempotency", key);
}

function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function withoutUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function isMonthlyRecurringExpense(
  expense: Pick<ExpenseApiRecord, "type" | "frequency">,
) {
  return (
    (expense.type === "FIJO" || expense.type === "SUSCRIPCION") &&
    expense.frequency === "MENSUAL"
  );
}

function parseStoredExpense(id: string, data: Record<string, unknown>) {
  const inferredFrequency =
    data.frequency === undefined
      ? data.type === "FIJO" || data.type === "SUSCRIPCION"
        ? "MENSUAL"
        : "UNICO"
      : data.frequency;
  const parsed = expenseApiRecordSchema.safeParse({
    ...data,
    id,
    frequency: inferredFrequency,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`El gasto ${id} no cumple el contrato de salida: ${issues}`);
  }
  // Keep legacy records distinguishable from explicitly versioned records.
  // The recurrence resolver deliberately lets an explicit revision beat a
  // legacy timestamp; synthesizing series/revision fields here would invert
  // that precedence and could revive an obsolete amount.
  return parsed.data;
}

function publicExpenseRecord(expense: ExpenseApiRecord): ExpenseApiRecord {
  const chargeDay =
    typeof expense.chargeDay === "number" &&
    Number.isInteger(expense.chargeDay) &&
    expense.chargeDay >= 1 &&
    expense.chargeDay <= 31
      ? expense.chargeDay
      : undefined;
  const safeExpense = {
    ...expense,
    amount: Math.min(100_000_000, Math.max(0, expense.amount)),
    chargeDay,
  };
  if (!isMonthlyRecurringExpense(expense)) return safeExpense;
  const inferredStatus = expenseRecurrenceStatus(expense);
  return {
    ...safeExpense,
    effectiveFrom: expense.effectiveFrom || expense.month,
    seriesId: expense.seriesId || canonicalExpenseSeriesId(expense),
    recurrenceStatus:
      expense.recurrenceStatus === "CANCELLED" ||
      inferredStatus === "CANCELLED"
        ? "CANCELLED"
        : "ACTIVE",
    revision: expense.revision ?? 0,
  };
}

function newestExpense(
  stored: ExpenseApiRecord | undefined,
  discovered: ExpenseApiRecord | undefined,
) {
  if (!stored) return discovered;
  if (!discovered) return stored;
  return isNewerExpenseVersion(discovered, stored) ? discovered : stored;
}

function seriesStateOwnsCurrentExpense(
  storedSeries: ReturnType<typeof parseSeriesState>,
  currentExpense: ExpenseApiRecord | undefined,
) {
  return Boolean(
    storedSeries &&
      currentExpense &&
      storedSeries.latestExpense.id === currentExpense.id &&
      storedSeries.latestExpense.revision === currentExpense.revision,
  );
}

async function loadRecurringExpenses(userId: string) {
  const snapshot = await getDocs(expensesCollection(userId));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
    if (
      (data.type !== "FIJO" && data.type !== "SUSCRIPCION") ||
      (data.frequency !== undefined && data.frequency !== "MENSUAL")
    ) {
      return [];
    }
    try {
      return [parseStoredExpense(item.id, data)];
    } catch {
      // A malformed legacy row must not take every recurring write offline.
      // It remains visible for an explicit migration instead of being guessed.
      return [];
    }
  });
}

async function findSeriesSeedByIdentity(
  userId: string,
  input: NormalizedExpenseInput,
) {
  const records = await loadRecurringExpenses(userId);
  return selectExpenseSeriesForIdentity(records, input);
}

function parseSeriesState(data: Record<string, unknown> | undefined) {
  if (!data) return undefined;
  const revision = data.revision;
  const latestExpense = data.latestExpense;
  if (
    !Number.isInteger(revision) ||
    (revision as number) < 0 ||
    typeof latestExpense !== "object" ||
    latestExpense === null ||
    !("id" in latestExpense) ||
    typeof latestExpense.id !== "string"
  ) {
    throw new ApiError(
      500,
      "EXPENSE_SERIES_DATA_INVALID",
      "La serie de gasto almacenada no cumple el contrato",
    );
  }
  return {
    revision: revision as number,
    latestExpense: parseStoredExpense(
      latestExpense.id,
      latestExpense as Record<string, unknown>,
    ),
    latestPayloadHash:
      typeof data.latestPayloadHash === "string"
        ? data.latestPayloadHash
        : undefined,
  };
}

export async function listExpenses(
  userId: string,
  filters: ExpenseListQuery,
) {
  const snapshot = await getDocs(
    query(expensesCollection(userId), orderBy("createdAt", "desc")),
  );

  const expenses = snapshot.docs.map((item) =>
    parseStoredExpense(item.id, item.data()),
  );
  const periodExpenses = filters.month
    ? resolveExpensesForMonth(expenses, filters.month)
    : expenses;

  return periodExpenses
    .filter(
      (item) =>
        !filters.financialContext ||
        (item.financialContext ?? "PERSONAL") === filters.financialContext,
    )
    .slice(0, filters.limit)
    .map(publicExpenseRecord);
}

interface CreateExpenseOptions {
  principal: Principal;
  input: NormalizedExpenseInput;
  idempotencyKey: string;
  requestId: string;
}

export async function createExpenseIdempotently({
  principal,
  input,
  idempotencyKey,
  requestId,
}: CreateExpenseOptions) {
  const requestPayloadHash = payloadHash(input);
  const idemRef = idempotencyRef(
    principal.trackerUserId,
    IDEMPOTENCY_OPERATION,
    idempotencyKey,
  );
  const recurring = isMonthlyRecurringExpense(input);
  const recurrenceStatus = recurring
    ? expenseRecurrenceStatus(input)
    : undefined;
  if (recurring && input.month > monthInMexicoCity()) {
    throw new ApiError(
      422,
      "EXPENSE_SERIES_FUTURE_MONTH_UNSUPPORTED",
      "La API todavía no gestiona cambios recurrentes programados para meses futuros",
    );
  }
  const seriesLookup = recurring
    ? await findSeriesSeedByIdentity(principal.trackerUserId, input)
    : undefined;
  const seed = seriesLookup?.seed;
  const seriesId = seriesLookup?.seriesId;
  const seriesRef = seriesId
    ? expenseSeriesRef(principal.trackerUserId, seriesId)
    : undefined;
  const identity = recurring ? canonicalExpenseSeriesId(input) : undefined;
  const identityClaimRef = identity
    ? expenseIdentityClaimRef(principal.trackerUserId, identity)
    : undefined;
  const expenseRef = doc(expensesCollection(principal.trackerUserId));
  const auditRef = doc(
    collection(db, "users", principal.trackerUserId, "auditEvents"),
  );

  return runTransaction(db, async (transaction) => {
    const previous = await transaction.get(idemRef);
    const seriesSnapshot = seriesRef
      ? await transaction.get(seriesRef)
      : undefined;
    const identityClaimSnapshot = identityClaimRef
      ? await transaction.get(identityClaimRef)
      : undefined;

    if (previous.exists()) {
      const stored = previous.data();
      if (stored.payloadHash !== requestPayloadHash) {
        throw new IdempotencyConflictError();
      }

      return {
        replayed: true,
        deduplicated: Boolean(stored.deduplicated),
        expense: stored.response as Record<string, unknown>,
      };
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + IDEMPOTENCY_TTL_MS);
    const storedSeries = parseSeriesState(
      seriesSnapshot?.exists() ? seriesSnapshot.data() : undefined,
    );
    const currentExpense = newestExpense(storedSeries?.latestExpense, seed);
    const currentRevision = Math.max(
      storedSeries?.revision || 0,
      currentExpense?.revision || 0,
    );
    const identityClaim = identityClaimSnapshot?.exists()
      ? identityClaimSnapshot.data()
      : undefined;
    if (
      recurring &&
      recurrenceStatus !== "CANCELLED" &&
      identityClaim?.status === "ACTIVE" &&
      identityClaim.seriesId !== seriesId
    ) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_IDENTITY_CONFLICT",
        "Otra serie activa ya utiliza esa identidad de gasto",
        { conflictingSeriesId: identityClaim.seriesId },
      );
    }

    if (
      recurring &&
      seriesStateOwnsCurrentExpense(storedSeries, currentExpense) &&
      storedSeries?.latestPayloadHash === requestPayloadHash &&
      currentExpense
    ) {
      transaction.set(auditRef, {
        actorId: principal.actorId,
        authMethod: principal.authMethod,
        action: "finance.expense.series.duplicate_suppressed",
        resourceType: "expenseSeries",
        resourceId: seriesId,
        requestId,
        result: "success",
        payloadHash: requestPayloadHash,
        createdAt: now,
      });
      transaction.set(idemRef, {
        operation: IDEMPOTENCY_OPERATION,
        payloadHash: requestPayloadHash,
        resourceType: "expenseSeries",
        resourceId: seriesId,
        response: currentExpense,
        deduplicated: true,
        requestId,
        createdAt: now,
        completedAt: now,
        expiresAt,
      });
      if (
        identityClaimRef &&
        identity &&
        seriesId &&
        recurrenceStatus !== "CANCELLED"
      ) {
        transaction.set(identityClaimRef, {
          identity,
          seriesId,
          status: "ACTIVE",
          updatedBy: principal.actorId,
          updatedAt: now,
        });
      }
      return {
        replayed: false,
        deduplicated: true,
        expense: currentExpense,
      };
    }

    if (
      recurring &&
      currentExpense &&
      canonicalExpenseSeriesId(currentExpense) !==
        canonicalExpenseSeriesId(input)
    ) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_IDENTITY_CONFLICT",
        "La identidad vigente de la serie cambió; vuelve a intentar la operación",
      );
    }

    if (
      recurring &&
      (currentExpense || seriesLookup?.identitySeenHistorically) &&
      input.month !== monthInMexicoCity()
    ) {
      throw new ApiError(
        422,
        "EXPENSE_SERIES_HISTORY_IMMUTABLE",
        "Una serie existente solo puede cambiar con vigencia en el mes actual",
      );
    }

    const nextRevision = recurring
      ? nextExpenseSeriesRevision(currentRevision, now.toMillis())
      : undefined;
    const expense = withoutUndefined({
      id: expenseRef.id,
      ...input,
      effectiveFrom: recurring ? input.month : undefined,
      seriesId,
      recurrenceStatus,
      revision: nextRevision,
      userId: principal.trackerUserId,
      createdBy: principal.actorId,
      createdAt: now,
      updatedAt: now,
    });

    transaction.set(expenseRef, withoutUndefined({ ...expense, id: undefined }));
    if (seriesRef && seriesId) {
      transaction.set(seriesRef, {
        seriesId,
        revision: nextRevision,
        status: recurrenceStatus,
        effectiveFrom: input.month,
        latestExpenseId: expenseRef.id,
        latestExpense: expense,
        latestPayloadHash: requestPayloadHash,
        updatedBy: principal.actorId,
        updatedAt: now,
      });
    }
    if (
      identityClaimRef &&
      identity &&
      seriesId &&
      recurrenceStatus !== "CANCELLED"
    ) {
      transaction.set(identityClaimRef, {
        identity,
        seriesId,
        status: "ACTIVE",
        updatedBy: principal.actorId,
        updatedAt: now,
      });
    } else if (
      identityClaimRef &&
      identity &&
      seriesId &&
      identityClaimSnapshot?.exists() &&
      identityClaimSnapshot.data().seriesId === seriesId
    ) {
      transaction.set(
        identityClaimRef,
        {
          identity,
          seriesId,
          status: "RELEASED",
          updatedBy: principal.actorId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    transaction.set(auditRef, {
      actorId: principal.actorId,
      authMethod: principal.authMethod,
      action:
        recurring && currentExpense
          ? "finance.expense.series.version_created"
          : "finance.expense.created",
      resourceType: recurring ? "expenseSeries" : "expense",
      resourceId: seriesId || expenseRef.id,
      requestId,
      result: "success",
      payloadHash: requestPayloadHash,
      createdAt: now,
    });
    transaction.set(idemRef, {
      operation: IDEMPOTENCY_OPERATION,
      payloadHash: requestPayloadHash,
      resourceType: recurring ? "expenseSeries" : "expense",
      resourceId: seriesId || expenseRef.id,
      response: expense,
      deduplicated: false,
      requestId,
      createdAt: now,
      completedAt: now,
      expiresAt,
    });

    return { replayed: false, deduplicated: false, expense };
  });
}

interface MutateExpenseSeriesOptions {
  principal: Principal;
  input: ExpenseSeriesMutationInput;
  idempotencyKey: string;
  requestId: string;
}

export async function mutateExpenseSeriesIdempotently({
  principal,
  input,
  idempotencyKey,
  requestId,
}: MutateExpenseSeriesOptions) {
  const requestPayloadHash = payloadHash(input);
  const normalizedUpdate =
    input.action === "UPDATE" ? normalizeExpenseInput(input.expense) : undefined;
  const recurringRecords = await loadRecurringExpenses(principal.trackerUserId);
  const seed = findCurrentExpenseBySeriesId(
    recurringRecords,
    input.seriesId,
  );
  const identityConflict = normalizedUpdate
    ? findActiveExpenseIdentityConflict(
        recurringRecords,
        normalizedUpdate,
        input.seriesId,
      )
    : undefined;
  const idemRef = idempotencyRef(
    principal.trackerUserId,
    SERIES_MUTATION_OPERATION,
    idempotencyKey,
  );
  const seriesRef = expenseSeriesRef(
    principal.trackerUserId,
    input.seriesId,
  );
  const expenseRef = doc(expensesCollection(principal.trackerUserId));
  const auditRef = doc(
    collection(db, "users", principal.trackerUserId, "auditEvents"),
  );

  return runTransaction(db, async (transaction) => {
    const [previous, seriesSnapshot] = await Promise.all([
      transaction.get(idemRef),
      transaction.get(seriesRef),
    ]);

    if (previous.exists()) {
      const stored = previous.data();
      if (stored.payloadHash !== requestPayloadHash) {
        throw new IdempotencyConflictError();
      }
      return {
        replayed: true,
        deduplicated: Boolean(stored.deduplicated),
        expense: stored.response as Record<string, unknown>,
      };
    }

    if (input.effectiveFrom !== monthInMexicoCity()) {
      throw new ApiError(
        422,
        "EXPENSE_SERIES_HISTORY_IMMUTABLE",
        "Las actualizaciones y cancelaciones solo pueden iniciar en el mes actual",
      );
    }

    if (identityConflict) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_IDENTITY_CONFLICT",
        "Otra serie activa ya utiliza esa identidad de gasto",
        { conflictingSeriesId: identityConflict.seriesId },
      );
    }

    const storedSeries = parseSeriesState(
      seriesSnapshot.exists() ? seriesSnapshot.data() : undefined,
    );
    const currentExpense = newestExpense(storedSeries?.latestExpense, seed);
    if (!currentExpense) {
      throw new ApiError(
        404,
        "EXPENSE_SERIES_NOT_FOUND",
        "No existe la serie de gasto indicada",
      );
    }

    const currentRevision = Math.max(
      storedSeries?.revision || 0,
      currentExpense.revision || 0,
    );
    if (currentRevision !== input.expectedRevision) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_REVISION_CONFLICT",
        "La serie cambió desde la última lectura",
        {
          expectedRevision: input.expectedRevision,
          currentRevision,
        },
      );
    }

    const oldIdentity = canonicalExpenseSeriesId(currentExpense);
    const desiredIdentity = normalizedUpdate
      ? canonicalExpenseSeriesId(normalizedUpdate)
      : oldIdentity;
    const desiredClaimRef = expenseIdentityClaimRef(
      principal.trackerUserId,
      desiredIdentity,
    );
    const desiredClaimSnapshot = await transaction.get(desiredClaimRef);
    const oldClaimRef =
      oldIdentity !== desiredIdentity
        ? expenseIdentityClaimRef(principal.trackerUserId, oldIdentity)
        : undefined;
    const oldClaimSnapshot = oldClaimRef
      ? await transaction.get(oldClaimRef)
      : undefined;

    const currentEffectiveFrom =
      currentExpense.effectiveFrom || currentExpense.month;
    if (input.effectiveFrom < currentEffectiveFrom) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_EFFECTIVE_MONTH_CONFLICT",
        "La nueva versión no puede iniciar antes de la versión vigente",
        {
          currentEffectiveFrom,
          requestedEffectiveFrom: input.effectiveFrom,
        },
      );
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + IDEMPOTENCY_TTL_MS);

    if (
      input.action === "STOP" &&
      currentExpense.recurrenceStatus === "CANCELLED"
    ) {
      transaction.set(auditRef, {
        actorId: principal.actorId,
        authMethod: principal.authMethod,
        action: "finance.expense.series.stop_duplicate_suppressed",
        resourceType: "expenseSeries",
        resourceId: input.seriesId,
        requestId,
        result: "success",
        payloadHash: requestPayloadHash,
        createdAt: now,
      });
      transaction.set(idemRef, {
        operation: SERIES_MUTATION_OPERATION,
        payloadHash: requestPayloadHash,
        resourceType: "expenseSeries",
        resourceId: input.seriesId,
        response: currentExpense,
        deduplicated: true,
        requestId,
        createdAt: now,
        completedAt: now,
        expiresAt,
      });
      if (
        desiredClaimSnapshot.exists() &&
        desiredClaimSnapshot.data().seriesId === input.seriesId
      ) {
        transaction.set(
          desiredClaimRef,
          {
            identity: desiredIdentity,
            seriesId: input.seriesId,
            status: "RELEASED",
            updatedBy: principal.actorId,
            updatedAt: now,
          },
          { merge: true },
        );
      }
      return {
        replayed: false,
        deduplicated: true,
        expense: currentExpense,
      };
    }

    const stopNotes = input.action === "STOP" ? input.notes : "";
    const recurrenceStatus = normalizedUpdate
      ? expenseRecurrenceStatus(normalizedUpdate)
      : ("CANCELLED" as const);
    const desiredClaim = desiredClaimSnapshot.exists()
      ? desiredClaimSnapshot.data()
      : undefined;
    if (
      recurrenceStatus !== "CANCELLED" &&
      desiredClaim?.status === "ACTIVE" &&
      desiredClaim.seriesId !== input.seriesId
    ) {
      throw new ApiError(
        409,
        "EXPENSE_SERIES_IDENTITY_CONFLICT",
        "Otra serie activa ya utiliza esa identidad de gasto",
        { conflictingSeriesId: desiredClaim.seriesId },
      );
    }
    const nextRevision = nextExpenseSeriesRevision(
      currentRevision,
      now.toMillis(),
    );
    const expense = withoutUndefined({
      id: expenseRef.id,
      ...(normalizedUpdate || {
        name: currentExpense.name,
        category: currentExpense.category,
        amount: Math.max(0.01, currentExpense.amount),
        type: currentExpense.type,
        frequency: "MENSUAL",
        chargeDay: currentExpense.chargeDay,
        month: input.effectiveFrom,
        isNecessity: currentExpense.isNecessity,
        financialContext: currentExpense.financialContext || "PERSONAL",
        productId: currentExpense.productId,
        productName: currentExpense.productName,
        subscriptionStatus:
          currentExpense.type === "SUSCRIPCION" ? "cancelled" : undefined,
        externalRef: currentExpense.externalRef,
        notes: stopNotes || currentExpense.notes,
      }),
      month: input.effectiveFrom,
      effectiveFrom: input.effectiveFrom,
      seriesId: input.seriesId,
      recurrenceStatus,
      revision: nextRevision,
      userId: principal.trackerUserId,
      createdBy: principal.actorId,
      createdAt: now,
      updatedAt: now,
    });
    const latestPayloadHash = normalizedUpdate
      ? payloadHash(normalizedUpdate)
      : requestPayloadHash;

    transaction.set(expenseRef, withoutUndefined({ ...expense, id: undefined }));
    transaction.set(seriesRef, {
      seriesId: input.seriesId,
      revision: nextRevision,
      status: recurrenceStatus,
      effectiveFrom: input.effectiveFrom,
      latestExpenseId: expenseRef.id,
      latestExpense: expense,
      latestPayloadHash,
      updatedBy: principal.actorId,
      updatedAt: now,
    });
    if (
      oldClaimRef &&
      oldClaimSnapshot?.exists() &&
      oldClaimSnapshot.data().seriesId === input.seriesId
    ) {
      transaction.set(
        oldClaimRef,
        {
          identity: oldIdentity,
          seriesId: input.seriesId,
          status: "RELEASED",
          updatedBy: principal.actorId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    if (recurrenceStatus !== "CANCELLED") {
      transaction.set(desiredClaimRef, {
        identity: desiredIdentity,
        seriesId: input.seriesId,
        status: "ACTIVE",
        updatedBy: principal.actorId,
        updatedAt: now,
      });
    } else if (
      desiredClaimSnapshot.exists() &&
      desiredClaimSnapshot.data().seriesId === input.seriesId
    ) {
      transaction.set(
        desiredClaimRef,
        {
          identity: desiredIdentity,
          seriesId: input.seriesId,
          status: "RELEASED",
          updatedBy: principal.actorId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    transaction.set(auditRef, {
      actorId: principal.actorId,
      authMethod: principal.authMethod,
      action:
        recurrenceStatus === "CANCELLED"
          ? "finance.expense.series.stopped"
          : "finance.expense.series.updated",
      resourceType: "expenseSeries",
      resourceId: input.seriesId,
      expenseId: expenseRef.id,
      revision: nextRevision,
      effectiveFrom: input.effectiveFrom,
      requestId,
      result: "success",
      payloadHash: requestPayloadHash,
      createdAt: now,
    });
    transaction.set(idemRef, {
      operation: SERIES_MUTATION_OPERATION,
      payloadHash: requestPayloadHash,
      resourceType: "expenseSeries",
      resourceId: input.seriesId,
      response: expense,
      deduplicated: false,
      requestId,
      createdAt: now,
      completedAt: now,
      expiresAt,
    });

    return { replayed: false, deduplicated: false, expense };
  });
}
