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
  ExpenseListQuery,
  NormalizedExpenseInput,
} from "@/contracts/expenses";
import { expenseApiRecordSchema } from "@/contracts/expenses";
import type { Principal } from "@/server/auth/principal";

const IDEMPOTENCY_OPERATION = "v1:finance.expenses.create";
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

function withoutUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function parseStoredExpense(id: string, data: Record<string, unknown>) {
  const parsed = expenseApiRecordSchema.safeParse({ ...data, id });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`El gasto ${id} no cumple el contrato de salida: ${issues}`);
  }
  return parsed.data;
}

export async function listExpenses(
  userId: string,
  filters: ExpenseListQuery,
) {
  const snapshot = await getDocs(
    query(expensesCollection(userId), orderBy("createdAt", "desc")),
  );

  return snapshot.docs
    .map((item) => parseStoredExpense(item.id, item.data()))
    .filter((item) => !filters.month || item.month === filters.month)
    .filter(
      (item) =>
        !filters.financialContext ||
        (item.financialContext ?? "PERSONAL") === filters.financialContext,
    )
    .slice(0, filters.limit);
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
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const keyHash = createHash("sha256")
    .update(
      `${principal.trackerUserId}:${IDEMPOTENCY_OPERATION}:${idempotencyKey}`,
    )
    .digest("hex");

  const idempotencyRef = doc(
    db,
    "users",
    principal.trackerUserId,
    "apiIdempotency",
    keyHash,
  );
  const expenseRef = doc(expensesCollection(principal.trackerUserId));
  const auditRef = doc(
    collection(db, "users", principal.trackerUserId, "auditEvents"),
  );

  return runTransaction(db, async (transaction) => {
    const previous = await transaction.get(idempotencyRef);

    if (previous.exists()) {
      const stored = previous.data();
      if (stored.payloadHash !== payloadHash) {
        throw new IdempotencyConflictError();
      }

      return {
        replayed: true,
        expense: stored.response as Record<string, unknown>,
      };
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + IDEMPOTENCY_TTL_MS);
    const expense = withoutUndefined({
      id: expenseRef.id,
      ...input,
      userId: principal.trackerUserId,
      createdBy: principal.actorId,
      createdAt: now,
      updatedAt: now,
    });

    transaction.set(expenseRef, withoutUndefined({ ...expense, id: undefined }));
    transaction.set(auditRef, {
      actorId: principal.actorId,
      authMethod: principal.authMethod,
      action: "finance.expense.created",
      resourceType: "expense",
      resourceId: expenseRef.id,
      requestId,
      result: "success",
      payloadHash,
      createdAt: now,
    });
    transaction.set(idempotencyRef, {
      operation: IDEMPOTENCY_OPERATION,
      payloadHash,
      resourceType: "expense",
      resourceId: expenseRef.id,
      response: expense,
      requestId,
      createdAt: now,
      completedAt: now,
      expiresAt,
    });

    return { replayed: false, expense };
  });
}
