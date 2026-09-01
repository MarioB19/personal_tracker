import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
  canonicalExpenseSeriesId,
  canonicalInfoproductFixedIdentity,
  findActiveExpenseIdentityConflict,
} from "@/lib/finance/expense-series";
import {
  normalizeConcept,
  recurringFixedSeriesId,
  resolveRecurringFixedExpenses,
} from "@/lib/finance/business-metrics";
import type { Expense, InfoproductFixedExpense } from "@/lib/types";

/**
 * Filter out undefined values to avoid Firestore "Unsupported field value: undefined" errors.
 * This is necessary because some form payloads may contain optional fields that are 
 * explicitly set to undefined.
 */
function sanitizeData(data: any) {
  return Object.keys(data).reduce((acc, key) => {
    const val = data[key];
    if (val !== undefined) {
      acc[key] = val;
    }
    return acc;
  }, {} as any);
}

// Generic helpers for Firestore CRUD operations scoped to a user

function userCollection(userId: string, collectionName: string) {
  return collection(db, "users", userId, collectionName);
}

function userDoc(userId: string, collectionName: string, docId: string) {
  return doc(db, "users", userId, collectionName, docId);
}

export async function getAll<T>(userId: string, collectionName: string): Promise<T[]> {
  const q = query(
    userCollection(userId, collectionName),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function getById<T>(
  userId: string,
  collectionName: string,
  docId: string
): Promise<T | null> {
  const snap = await getDoc(userDoc(userId, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function getFiltered<T>(
  userId: string,
  collectionName: string,
  field: string,
  value: string | number | boolean
): Promise<T[]> {
  const q = query(
    userCollection(userId, collectionName),
    where(field, "==", value),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function create<T extends DocumentData>(
  userId: string,
  collectionName: string,
  data: Omit<T, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const sanitizedData = sanitizeData(data);
  const docRef = await addDoc(userCollection(userId, collectionName), {
    ...sanitizedData,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function update<T extends DocumentData>(
  userId: string,
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const sanitizedData = sanitizeData(data);

  await updateDoc(userDoc(userId, collectionName, docId), {
    ...sanitizedData,
    updatedAt: Timestamp.now(),
  });
}

export async function remove(
  userId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  await deleteDoc(userDoc(userId, collectionName, docId));
}

// ════════════════════════════════════════════════
// SPECIFIC REPOSITORIES
// ════════════════════════════════════════════════

// Finance sub-collections live under users/{uid}/finance/{subCollection}
function financeCollection(userId: string, subCollection: string) {
  return collection(db, "users", userId, "finance", "data", subCollection);
}

function financeDoc(userId: string, subCollection: string, docId: string) {
  return doc(db, "users", userId, "finance", "data", subCollection, docId);
}

export async function getAllFinance<T>(userId: string, subCollection: string): Promise<T[]> {
  const q = query(
    financeCollection(userId, subCollection),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function getFinanceFiltered<T>(
  userId: string,
  subCollection: string,
  field: string,
  value: string | number | boolean
): Promise<T[]> {
  const q = query(
    financeCollection(userId, subCollection),
    where(field, "==", value),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function createFinance<T extends DocumentData>(
  userId: string,
  subCollection: string,
  data: Omit<T, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const sanitizedData = sanitizeData(data);
  const docRef = await addDoc(financeCollection(userId, subCollection), {
    ...sanitizedData,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export class FinanceRecurrenceConflictError extends Error {
  constructor() {
    super("El gasto recurrente cambió mientras estaba abierto");
    this.name = "FinanceRecurrenceConflictError";
  }
}

async function seriesStateDocumentId(seriesId: string): Promise<string> {
  const encoded = new TextEncoder().encode(seriesId);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function storedExpenseIdentity(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || typeof record.type !== "string") {
    return undefined;
  }
  return canonicalExpenseSeriesId({
    financialContext:
      record.financialContext === "BUSINESS" ? "BUSINESS" : "PERSONAL",
    type: record.type,
    name: record.name,
    productId:
      typeof record.productId === "string" ? record.productId : undefined,
    productName:
      typeof record.productName === "string" ? record.productName : undefined,
    externalRef:
      typeof record.externalRef === "string" ? record.externalRef : undefined,
  });
}

/**
 * Appends an immutable recurring-expense version and advances the same series
 * state used by the local API. The optimistic revision prevents a stale modal
 * from silently overwriting a newer API or UI decision.
 */
export async function createRecurringExpenseVersion(
  userId: string,
  data: Record<string, unknown> & {
    name: string;
    type: string;
    financialContext?: "PERSONAL" | "BUSINESS";
    productId?: string;
    productName?: string;
    externalRef?: string;
    seriesId: string;
    effectiveFrom: string;
    recurrenceStatus: "ACTIVE" | "CANCELLED";
    revision?: number;
  },
  expectedRevision = 0,
): Promise<string> {
  if (data.recurrenceStatus === "ACTIVE") {
    const freshSnapshot = await getDocs(financeCollection(userId, "expenses"));
    const freshRecurring = freshSnapshot.docs.flatMap((item) => {
      const record = { id: item.id, ...item.data() } as Expense;
      if (
        !record.name ||
        !record.month ||
        (record.type !== "FIJO" && record.type !== "SUSCRIPCION") ||
        (record.frequency && record.frequency !== "MENSUAL")
      ) {
        return [];
      }
      return [record];
    });
    if (
      findActiveExpenseIdentityConflict(
        freshRecurring,
        data,
        data.seriesId,
      )
    ) {
      throw new FinanceRecurrenceConflictError();
    }
  }

  const stateId = await seriesStateDocumentId(data.seriesId);
  const seriesRef = financeDoc(userId, "expenseSeries", stateId);
  const identity = canonicalExpenseSeriesId(data);
  const claimId = await seriesStateDocumentId(identity);
  const claimRef = financeDoc(userId, "expenseIdentityClaims", claimId);
  const expenseRef = doc(financeCollection(userId, "expenses"));
  const sanitized = sanitizeData(data);

  await runTransaction(db, async (transaction) => {
    const [stateSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(seriesRef),
      transaction.get(claimRef),
    ]);
    const stateData = stateSnapshot.exists() ? stateSnapshot.data() : undefined;
    const oldIdentity = storedExpenseIdentity(stateData?.latestExpense);
    const oldClaimRef =
      oldIdentity && oldIdentity !== identity
        ? financeDoc(
            userId,
            "expenseIdentityClaims",
            await seriesStateDocumentId(oldIdentity),
          )
        : undefined;
    const oldClaimSnapshot = oldClaimRef
      ? await transaction.get(oldClaimRef)
      : undefined;
    const storedRevision = stateSnapshot.exists()
      ? stateData?.revision
      : undefined;
    if (
      stateSnapshot.exists() &&
      (!Number.isInteger(storedRevision) || storedRevision !== expectedRevision)
    ) {
      throw new FinanceRecurrenceConflictError();
    }

    const activeClaim = claimSnapshot.exists() ? claimSnapshot.data() : undefined;
    const wantsActive = data.recurrenceStatus === "ACTIVE";
    if (
      wantsActive &&
      activeClaim?.status === "ACTIVE" &&
      activeClaim.seriesId !== data.seriesId
    ) {
      throw new FinanceRecurrenceConflictError();
    }
    if (stateSnapshot.exists()) {
      const latestExpense = stateData?.latestExpense;
      const latestEffectiveFrom =
        typeof latestExpense === "object" &&
        latestExpense !== null &&
        ("effectiveFrom" in latestExpense || "month" in latestExpense)
          ? String(
              "effectiveFrom" in latestExpense
                ? latestExpense.effectiveFrom
                : latestExpense.month,
            )
          : "";
      if (latestEffectiveFrom && data.effectiveFrom < latestEffectiveFrom) {
        throw new FinanceRecurrenceConflictError();
      }
    }

    const now = Timestamp.now();
    const proposedRevision =
      typeof data.revision === "number" && Number.isFinite(data.revision)
        ? data.revision
        : 0;
    const revision = Math.max(
      proposedRevision,
      expectedRevision + 1,
      now.toMillis(),
    );
    const expense = sanitizeData({
      ...sanitized,
      revision,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    const latestExpense = { id: expenseRef.id, ...expense };

    transaction.set(expenseRef, expense);
    transaction.set(seriesRef, {
      seriesId: data.seriesId,
      revision,
      status: data.recurrenceStatus,
      effectiveFrom: data.effectiveFrom,
      latestExpenseId: expenseRef.id,
      latestExpense,
      updatedBy: userId,
      updatedAt: now,
    });
    if (
      oldClaimRef &&
      oldClaimSnapshot?.exists() &&
      oldClaimSnapshot.data().seriesId === data.seriesId
    ) {
      transaction.set(
        oldClaimRef,
        {
          identity: oldIdentity,
          seriesId: data.seriesId,
          status: "RELEASED",
          updatedBy: userId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    if (wantsActive) {
      transaction.set(claimRef, {
        identity,
        seriesId: data.seriesId,
        status: "ACTIVE",
        updatedBy: userId,
        updatedAt: now,
      });
    } else if (
      claimSnapshot.exists() &&
      claimSnapshot.data().seriesId === data.seriesId
    ) {
      transaction.set(
        claimRef,
        {
          identity,
          seriesId: data.seriesId,
          status: "RELEASED",
          updatedBy: userId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  });

  return expenseRef.id;
}

/**
 * Appends an immutable version to the Health Check fixed-expense ledger.
 * A dedicated series-state document gives this legacy ledger the same
 * optimistic concurrency guarantees as the general expense ledger.
 */
export async function createInfoproductFixedExpenseVersion(
  userId: string,
  data: Record<string, unknown> & {
    concept: string;
    seriesId: string;
    effectiveFrom: string;
    status: "ACTIVE" | "CANCELLED";
    revision?: number;
  },
  expectedRevision: number,
  options: {
    existingSeries: boolean;
    identitySeenHistorically?: boolean;
    currentMonth: string;
  },
): Promise<string> {
  if (
    data.effectiveFrom > options.currentMonth ||
    ((options.existingSeries || options.identitySeenHistorically) &&
      data.effectiveFrom !== options.currentMonth)
  ) {
    throw new FinanceRecurrenceConflictError();
  }

  if (data.status === "ACTIVE") {
    const freshSnapshot = await getDocs(
      financeCollection(userId, "infoproduct_fixed_expenses"),
    );
    const freshFixed = freshSnapshot.docs.flatMap((item) => {
      const record = {
        id: item.id,
        ...item.data(),
      } as InfoproductFixedExpense;
      if (!record.concept || !record.month) return [];
      return [record];
    });
    const conflict = resolveRecurringFixedExpenses(
      freshFixed,
      options.currentMonth,
    ).some(
      (expense) =>
        normalizeConcept(expense.concept) === normalizeConcept(data.concept) &&
        recurringFixedSeriesId(expense) !== data.seriesId,
    );
    if (conflict) throw new FinanceRecurrenceConflictError();
  }

  const stateId = await seriesStateDocumentId(data.seriesId);
  const seriesRef = financeDoc(
    userId,
    "infoproductFixedExpenseSeries",
    stateId,
  );
  const identity = canonicalInfoproductFixedIdentity(data.concept);
  const claimId = await seriesStateDocumentId(identity);
  const claimRef = financeDoc(
    userId,
    "infoproductFixedExpenseClaims",
    claimId,
  );
  const expenseRef = doc(
    financeCollection(userId, "infoproduct_fixed_expenses"),
  );
  const sanitized = sanitizeData(data);

  await runTransaction(db, async (transaction) => {
    const [stateSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(seriesRef),
      transaction.get(claimRef),
    ]);
    const stateData = stateSnapshot.exists() ? stateSnapshot.data() : undefined;
    const previousExpense = stateData?.latestExpense;
    const oldConcept =
      previousExpense &&
      typeof previousExpense === "object" &&
      "concept" in previousExpense &&
      typeof previousExpense.concept === "string"
        ? previousExpense.concept
        : undefined;
    const oldIdentity = oldConcept
      ? canonicalInfoproductFixedIdentity(oldConcept)
      : undefined;
    const oldClaimRef =
      oldIdentity && oldIdentity !== identity
        ? financeDoc(
            userId,
            "infoproductFixedExpenseClaims",
            await seriesStateDocumentId(oldIdentity),
          )
        : undefined;
    const oldClaimSnapshot = oldClaimRef
      ? await transaction.get(oldClaimRef)
      : undefined;
    const storedRevision = stateSnapshot.exists()
      ? stateData?.revision
      : undefined;
    if (
      stateSnapshot.exists() &&
      (!Number.isInteger(storedRevision) || storedRevision !== expectedRevision)
    ) {
      throw new FinanceRecurrenceConflictError();
    }

    const activeClaim = claimSnapshot.exists() ? claimSnapshot.data() : undefined;
    const wantsActive = data.status === "ACTIVE";
    if (
      wantsActive &&
      activeClaim?.status === "ACTIVE" &&
      activeClaim.seriesId !== data.seriesId
    ) {
      throw new FinanceRecurrenceConflictError();
    }

    const latestEffectiveFrom = stateSnapshot.exists()
      ? String(stateData?.effectiveFrom || "")
      : "";
    if (latestEffectiveFrom && data.effectiveFrom < latestEffectiveFrom) {
      throw new FinanceRecurrenceConflictError();
    }

    const now = Timestamp.now();
    const proposedRevision =
      typeof data.revision === "number" && Number.isFinite(data.revision)
        ? data.revision
        : 0;
    const revision = Math.max(
      proposedRevision,
      expectedRevision + 1,
      now.toMillis(),
    );
    const expense = sanitizeData({
      ...sanitized,
      revision,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    const latestExpense = { id: expenseRef.id, ...expense };

    transaction.set(expenseRef, expense);
    transaction.set(seriesRef, {
      seriesId: data.seriesId,
      revision,
      status: data.status,
      effectiveFrom: data.effectiveFrom,
      latestExpenseId: expenseRef.id,
      latestExpense,
      updatedBy: userId,
      updatedAt: now,
    });
    if (
      oldClaimRef &&
      oldClaimSnapshot?.exists() &&
      oldClaimSnapshot.data().seriesId === data.seriesId
    ) {
      transaction.set(
        oldClaimRef,
        {
          identity: oldIdentity,
          seriesId: data.seriesId,
          status: "RELEASED",
          updatedBy: userId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    if (wantsActive) {
      transaction.set(claimRef, {
        identity,
        seriesId: data.seriesId,
        status: "ACTIVE",
        updatedBy: userId,
        updatedAt: now,
      });
    } else if (
      claimSnapshot.exists() &&
      claimSnapshot.data().seriesId === data.seriesId
    ) {
      transaction.set(
        claimRef,
        {
          identity,
          seriesId: data.seriesId,
          status: "RELEASED",
          updatedBy: userId,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  });

  return expenseRef.id;
}

export async function updateFinance<T extends DocumentData>(
  userId: string,
  subCollection: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const sanitizedData = sanitizeData(data);
  await updateDoc(financeDoc(userId, subCollection, docId), {
    ...sanitizedData,
    updatedAt: Timestamp.now(),
  });
}

export async function removeFinance(
  userId: string,
  subCollection: string,
  docId: string
): Promise<void> {
  await deleteDoc(financeDoc(userId, subCollection, docId));
}
