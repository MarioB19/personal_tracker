import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
  normalizeFinancialCut,
  normalizeSavingsPlan,
  planToFirestoreData,
  savingsPlanDocumentId,
  type PlanDraft,
} from "@/lib/planning/savings-plan";
import type { FinancialCut, PlanMilestone } from "@/lib/types";

export class SavingsPlanConflictError extends Error {
  constructor() {
    super("El plan cambió en otra pestaña o dispositivo. Recarga antes de guardar.");
    this.name = "SavingsPlanConflictError";
  }
}

export interface LoadedSavingsPlan {
  docId: string;
  exists: boolean;
  plan: PlanDraft;
}

/**
 * Lee el plan de un año. Primero el ID determinista `{uid}_{year}`; si no
 * existe, busca documentos heredados con ID aleatorio para no perderlos.
 */
export async function loadSavingsPlan(
  userId: string,
  year: number,
): Promise<LoadedSavingsPlan> {
  const docId = savingsPlanDocumentId(userId, year);
  const snapshot = await getDoc(doc(db, "savings_plans", docId));
  if (snapshot.exists()) {
    return { docId, exists: true, plan: normalizeSavingsPlan(snapshot.data(), year) };
  }

  const legacy = await getDocs(
    query(
      collection(db, "savings_plans"),
      where("userId", "==", userId),
      where("year", "==", year),
    ),
  );
  if (!legacy.empty) {
    const first = legacy.docs[0];
    return {
      docId: first.id,
      exists: true,
      plan: normalizeSavingsPlan(first.data(), year),
    };
  }

  return { docId, exists: false, plan: normalizeSavingsPlan(null, year) };
}

/**
 * Guarda el plan completo con control optimista: si otro guardado avanzó la
 * revisión desde que se cargó, rechaza la escritura en vez de sobrescribirla.
 */
export async function saveSavingsPlan(
  userId: string,
  docId: string,
  plan: PlanDraft,
): Promise<number> {
  const ref = doc(db, "savings_plans", docId);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (current.exists() && Number(current.data().year) !== plan.year) {
      throw new SavingsPlanConflictError();
    }
    const currentRevision = current.exists()
      ? normalizeSavingsPlan(current.data(), plan.year).revision
      : 0;
    if (currentRevision !== plan.revision) throw new SavingsPlanConflictError();

    const nextRevision = currentRevision + 1;
    const now = Timestamp.now();
    transaction.set(ref, {
      ...planToFirestoreData(plan, userId),
      revision: nextRevision,
      createdAt: current.exists() ? (current.data().createdAt ?? now) : now,
      updatedAt: now,
    });
    return nextRevision;
  });
}

/**
 * Cambios puntuales desde Finanzas (ahorro real e hitos): conservan el resto
 * del plan y avanzan la revisión para que el Planificador detecte el cambio.
 */
export async function patchSavingsPlanTracking(
  userId: string,
  year: number,
  patch: (plan: PlanDraft) => {
    actualSavingsValues?: number[];
    milestones?: PlanMilestone[];
  },
): Promise<boolean> {
  const loaded = await loadSavingsPlan(userId, year);
  if (!loaded.exists) return false;
  const ref = doc(db, "savings_plans", loaded.docId);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists()) throw new SavingsPlanConflictError();
    const plan = normalizeSavingsPlan(current.data(), year);
    const changes = patch(plan);
    transaction.set(
      ref,
      {
        ...(changes.actualSavingsValues
          ? { actualSavingsValues: changes.actualSavingsValues }
          : {}),
        ...(changes.milestones ? { milestones: changes.milestones } : {}),
        revision: plan.revision + 1,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  });
  return true;
}

/** Último corte financiero registrado (por fecha). */
export async function loadLatestFinancialCut(
  userId: string,
): Promise<FinancialCut | null> {
  const snapshot = await getDocs(
    query(
      collection(db, "users", userId, "financialCuts"),
      orderBy("date", "desc"),
      limit(1),
    ),
  );
  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return normalizeFinancialCut(first.data(), first.id);
}
