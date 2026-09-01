import { createHash } from "node:crypto";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  AGENDA_TIME_ZONE,
  normalizeTemplateSlots,
  summarizeWeeklyTemplate,
  weeklyTemplatePreviewSchema,
  weeklyTemplateSlotSchema,
  type AgendaWeekApplyInput,
  type WeeklyTemplateReplaceInput,
  type WeeklyTemplateSlot,
} from "@/contracts/agenda";
import { db } from "@/lib/firebase/config";
import { ApiError, type Principal } from "@/server/auth/principal";

const TEMPLATE_REPLACE_OPERATION = "v1:agenda.template.replace";
const WEEK_APPLY_OPERATION = "v1:agenda.week.apply";
const IDEMPOTENCY_TTL_MS = 90 * 24 * 60 * 60 * 1_000;
const FIRESTORE_ATOMIC_WRITE_LIMIT = 500;

export const AGENDA_ATOMICITY_NOTICE =
  "El commit es atómico y usa revisión por semana para llamadas API. Mientras la UI siga escribiendo directamente con el SDK web, una escritura nueva fuera de la API que ocurra durante el reemplazo no puede quedar aislada por la consulta previa.";

export interface WeeklyTemplateRecord {
  exists: boolean;
  revision: number;
  timezone: typeof AGENDA_TIME_ZONE;
  slots: WeeklyTemplateSlot[];
  summary: ReturnType<typeof summarizeWeeklyTemplate>;
  updatedAt?: unknown;
  updatedBy?: string;
}

interface TemplateReplaceOptions {
  principal: Principal;
  input: WeeklyTemplateReplaceInput;
  idempotencyKey: string;
  requestId: string;
}

interface WeekApplyOptions {
  principal: Principal;
  input: AgendaWeekApplyInput & { dryRun: false; expectedWeekRevision: number };
  idempotencyKey: string;
  requestId: string;
}

function weeklyTemplateRef(userId: string) {
  return doc(db, "weekly_templates", userId);
}

function timeBlocksCollection(userId: string) {
  return collection(db, "users", userId, "timeBlocks");
}

function weekStateRef(userId: string, weekId: string) {
  return doc(db, "users", userId, "agendaWeeks", weekId);
}

function idempotencyRef(
  userId: string,
  operation: string,
  idempotencyKey: string,
) {
  const keyHash = createHash("sha256")
    .update(`${userId}:${operation}:${idempotencyKey}`)
    .digest("hex");
  return doc(db, "users", userId, "apiIdempotency", keyHash);
}

function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function agendaBlockId(weekId: string, slotId: string) {
  return `agenda_${weekId.replace("-", "_")}_${slotId}`;
}

function legacySlotId(value: Record<string, unknown>, index: number) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        day: value.day,
        startTime: value.startTime,
        endTime: value.endTime,
        title: value.title,
        category: value.category,
        index,
      }),
    )
    .digest("hex")
    .slice(0, 16);
  return `legacy_${hash}`;
}

function normalizeStoredSlot(value: unknown, index: number) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidStoredAgendaError(`slots.${index} no es un objeto`);
  }

  const raw = value as Record<string, unknown>;
  const candidate = {
    id: raw.id ?? legacySlotId(raw, index),
    day: raw.day,
    startTime: raw.startTime,
    endTime: raw.endTime,
    title: raw.title,
    category: raw.category,
    ...(raw.activityId !== undefined ? { activityId: raw.activityId } : {}),
    ...(raw.projectTag !== undefined ? { projectTag: raw.projectTag } : {}),
    notes: raw.notes ?? "",
  };
  const parsed = weeklyTemplateSlotSchema.safeParse(candidate);
  if (!parsed.success) {
    throw invalidStoredAgendaError(
      `slots.${index}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

function normalizeStoredTemplate(
  data: DocumentData | undefined,
): WeeklyTemplateRecord {
  if (!data) {
    return {
      exists: false,
      revision: 0,
      timezone: AGENDA_TIME_ZONE,
      slots: [],
      summary: summarizeWeeklyTemplate([]),
    };
  }

  const rawSlots = data.slots;
  if (!Array.isArray(rawSlots)) {
    throw invalidStoredAgendaError("slots debe ser un arreglo");
  }

  const revision = data.revision ?? 0;
  if (!Number.isInteger(revision) || revision < 0) {
    throw invalidStoredAgendaError("revision debe ser un entero no negativo");
  }

  const slots = normalizeTemplateSlots(rawSlots.map(normalizeStoredSlot));
  if (slots.length > 0) {
    const schedule = weeklyTemplatePreviewSchema.safeParse({
      timezone: data.timezone ?? AGENDA_TIME_ZONE,
      slots,
    });
    if (!schedule.success) {
      throw invalidStoredAgendaError(
        schedule.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      );
    }
  }

  if ((data.timezone ?? AGENDA_TIME_ZONE) !== AGENDA_TIME_ZONE) {
    throw invalidStoredAgendaError(
      `timezone debe ser ${AGENDA_TIME_ZONE}`,
    );
  }

  return {
    exists: true,
    revision,
    timezone: AGENDA_TIME_ZONE,
    slots,
    summary: summarizeWeeklyTemplate(slots),
    updatedAt: data.updatedAt,
    updatedBy:
      typeof data.updatedBy === "string" ? data.updatedBy : undefined,
  };
}

function invalidStoredAgendaError(details: string) {
  return new ApiError(
    500,
    "AGENDA_DATA_INVALID",
    "La agenda almacenada no cumple el contrato de la API",
    details,
  );
}

function readWeekRevision(data: DocumentData | undefined) {
  const revision = data?.revision ?? 0;
  if (!Number.isInteger(revision) || revision < 0) {
    throw invalidStoredAgendaError(
      "La revisión almacenada de la semana no es válida",
    );
  }
  return revision as number;
}

function assertIdempotencyPayload(
  stored: DocumentData,
  expectedPayloadHash: string,
) {
  if (stored.payloadHash !== expectedPayloadHash) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "La llave de idempotencia ya fue usada con otros datos",
    );
  }
}

export async function getWeeklyTemplate(userId: string) {
  const snapshot = await getDoc(weeklyTemplateRef(userId));
  return normalizeStoredTemplate(snapshot.exists() ? snapshot.data() : undefined);
}

export async function replaceWeeklyTemplateIdempotently({
  principal,
  input,
  idempotencyKey,
  requestId,
}: TemplateReplaceOptions) {
  const slots = normalizeTemplateSlots(input.slots);
  const normalizedInput = {
    timezone: AGENDA_TIME_ZONE,
    slots,
    expectedRevision: input.expectedRevision,
  };
  const requestPayloadHash = payloadHash(normalizedInput);
  const templateRef = weeklyTemplateRef(principal.trackerUserId);
  const idemRef = idempotencyRef(
    principal.trackerUserId,
    TEMPLATE_REPLACE_OPERATION,
    idempotencyKey,
  );
  const auditRef = doc(
    collection(db, "users", principal.trackerUserId, "auditEvents"),
  );

  return runTransaction(db, async (transaction) => {
    const [previous, currentSnapshot] = await Promise.all([
      transaction.get(idemRef),
      transaction.get(templateRef),
    ]);

    if (previous.exists()) {
      assertIdempotencyPayload(previous.data(), requestPayloadHash);
      return {
        replayed: true,
        template: previous.data().response as WeeklyTemplateRecord,
      };
    }

    const current = normalizeStoredTemplate(
      currentSnapshot.exists() ? currentSnapshot.data() : undefined,
    );
    if (current.revision !== input.expectedRevision) {
      throw new ApiError(
        409,
        "AGENDA_TEMPLATE_REVISION_CONFLICT",
        "La plantilla cambió desde la última lectura",
        {
          expectedRevision: input.expectedRevision,
          currentRevision: current.revision,
        },
      );
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + IDEMPOTENCY_TTL_MS);
    const template: WeeklyTemplateRecord = {
      exists: true,
      revision: current.revision + 1,
      timezone: AGENDA_TIME_ZONE,
      slots,
      summary: summarizeWeeklyTemplate(slots),
      updatedAt: now,
      updatedBy: principal.actorId,
    };

    transaction.set(templateRef, {
      revision: template.revision,
      timezone: template.timezone,
      slots: template.slots,
      updatedAt: now,
      updatedBy: principal.actorId,
    });
    transaction.set(auditRef, {
      actorId: principal.actorId,
      authMethod: principal.authMethod,
      action: "agenda.template.replaced",
      resourceType: "weekly_template",
      resourceId: principal.trackerUserId,
      requestId,
      result: "success",
      previousRevision: current.revision,
      revision: template.revision,
      slotCount: slots.length,
      payloadHash: requestPayloadHash,
      createdAt: now,
    });
    transaction.set(idemRef, {
      operation: TEMPLATE_REPLACE_OPERATION,
      payloadHash: requestPayloadHash,
      resourceType: "weekly_template",
      resourceId: principal.trackerUserId,
      response: template,
      requestId,
      createdAt: now,
      completedAt: now,
      expiresAt,
    });

    return { replayed: false, template };
  });
}

interface WeekPreflight {
  template: WeeklyTemplateRecord;
  currentWeekRevision: number;
  existing: QueryDocumentSnapshot<DocumentData, DocumentData>[];
  targetRefs: Map<string, DocumentReference<DocumentData, DocumentData>>;
  deleteCount: number;
  atomicWriteCount: number;
}

async function loadWeekPreflight(
  userId: string,
  input: AgendaWeekApplyInput,
): Promise<WeekPreflight> {
  const blocksQuery = query(
    timeBlocksCollection(userId),
    where("weekId", "==", input.weekId),
  );
  const [template, stateSnapshot, blocksSnapshot] = await Promise.all([
    getWeeklyTemplate(userId),
    getDoc(weekStateRef(userId, input.weekId)),
    getDocs(blocksQuery),
  ]);

  if (!template.exists || template.slots.length === 0) {
    throw new ApiError(
      409,
      "AGENDA_TEMPLATE_EMPTY",
      "No existe una plantilla semanal para aplicar",
    );
  }
  if (template.revision !== input.expectedTemplateRevision) {
    throw new ApiError(
      409,
      "AGENDA_TEMPLATE_REVISION_CONFLICT",
      "La plantilla cambió desde la última lectura",
      {
        expectedRevision: input.expectedTemplateRevision,
        currentRevision: template.revision,
      },
    );
  }

  const targetRefs = new Map(
    template.slots.map((slot) => {
      const ref = doc(
        timeBlocksCollection(userId),
        agendaBlockId(input.weekId, slot.id),
      );
      return [ref.id, ref] as const;
    }),
  );
  const existing = blocksSnapshot.docs;
  const deleteCount = existing.filter((item) => !targetRefs.has(item.id)).length;
  const atomicWriteCount = deleteCount + template.slots.length + 3;

  return {
    template,
    currentWeekRevision: readWeekRevision(
      stateSnapshot.exists() ? stateSnapshot.data() : undefined,
    ),
    existing,
    targetRefs,
    deleteCount,
    atomicWriteCount,
  };
}

function weekApplyPlan(
  input: AgendaWeekApplyInput,
  preflight: WeekPreflight,
) {
  const canApplyAtomically =
    preflight.atomicWriteCount <= FIRESTORE_ATOMIC_WRITE_LIMIT;
  const warnings = [...preflight.template.summary.warnings];
  if (preflight.existing.length > 0) {
    warnings.push(
      `El modo replace sustituirá ${preflight.existing.length} bloques existentes de ${input.weekId}`,
    );
  }
  warnings.push(AGENDA_ATOMICITY_NOTICE);

  return {
    dryRun: input.dryRun,
    writes: !input.dryRun,
    mode: input.mode,
    weekId: input.weekId,
    timezone: preflight.template.timezone,
    templateRevision: preflight.template.revision,
    currentWeekRevision: preflight.currentWeekRevision,
    nextWeekRevision: preflight.currentWeekRevision + 1,
    existingCount: preflight.existing.length,
    deleteCount: preflight.deleteCount,
    upsertCount: preflight.template.slots.length,
    atomicWriteCount: preflight.atomicWriteCount,
    atomicWriteLimit: FIRESTORE_ATOMIC_WRITE_LIMIT,
    canApplyAtomically,
    warnings,
  };
}

export async function previewWeeklyTemplateApply(
  userId: string,
  input: AgendaWeekApplyInput,
) {
  const preflight = await loadWeekPreflight(userId, input);
  return weekApplyPlan({ ...input, dryRun: true }, preflight);
}

export async function applyWeeklyTemplateToWeekIdempotently({
  principal,
  input,
  idempotencyKey,
  requestId,
}: WeekApplyOptions) {
  const preflight = await loadWeekPreflight(principal.trackerUserId, input);
  if (input.expectedWeekRevision !== preflight.currentWeekRevision) {
    throw new ApiError(
      409,
      "AGENDA_WEEK_REVISION_CONFLICT",
      "La semana cambió desde la última previsualización",
      {
        expectedRevision: input.expectedWeekRevision,
        currentRevision: preflight.currentWeekRevision,
      },
    );
  }
  if (preflight.atomicWriteCount > FIRESTORE_ATOMIC_WRITE_LIMIT) {
    throw new ApiError(
      409,
      "AGENDA_ATOMIC_WRITE_LIMIT_EXCEEDED",
      "El reemplazo excede el límite atómico de Firestore",
      {
        atomicWriteCount: preflight.atomicWriteCount,
        atomicWriteLimit: FIRESTORE_ATOMIC_WRITE_LIMIT,
      },
    );
  }

  const normalizedInput = {
    weekId: input.weekId,
    mode: input.mode,
    dryRun: false,
    expectedTemplateRevision: input.expectedTemplateRevision,
    expectedWeekRevision: input.expectedWeekRevision,
  };
  const requestPayloadHash = payloadHash(normalizedInput);
  const idemRef = idempotencyRef(
    principal.trackerUserId,
    WEEK_APPLY_OPERATION,
    idempotencyKey,
  );
  const templateRef = weeklyTemplateRef(principal.trackerUserId);
  const stateRef = weekStateRef(principal.trackerUserId, input.weekId);
  const auditRef = doc(
    collection(db, "users", principal.trackerUserId, "auditEvents"),
  );

  return runTransaction(db, async (transaction) => {
    const [previous, templateSnapshot, stateSnapshot, ...blockSnapshots] =
      await Promise.all([
        transaction.get(idemRef),
        transaction.get(templateRef),
        transaction.get(stateRef),
        ...preflight.existing.map((item) => transaction.get(item.ref)),
      ]);

    if (previous.exists()) {
      assertIdempotencyPayload(previous.data(), requestPayloadHash);
      return {
        replayed: true,
        result: previous.data().response as Record<string, unknown>,
      };
    }

    const template = normalizeStoredTemplate(
      templateSnapshot.exists() ? templateSnapshot.data() : undefined,
    );
    if (template.revision !== input.expectedTemplateRevision) {
      throw new ApiError(
        409,
        "AGENDA_TEMPLATE_REVISION_CONFLICT",
        "La plantilla cambió desde la previsualización",
        {
          expectedRevision: input.expectedTemplateRevision,
          currentRevision: template.revision,
        },
      );
    }

    const currentWeekRevision = readWeekRevision(
      stateSnapshot.exists() ? stateSnapshot.data() : undefined,
    );
    if (currentWeekRevision !== input.expectedWeekRevision) {
      throw new ApiError(
        409,
        "AGENDA_WEEK_REVISION_CONFLICT",
        "La semana cambió desde la previsualización",
        {
          expectedRevision: input.expectedWeekRevision,
          currentRevision: currentWeekRevision,
        },
      );
    }

    const targetRefs = new Map(
      template.slots.map((slot) => {
        const ref = doc(
          timeBlocksCollection(principal.trackerUserId),
          agendaBlockId(input.weekId, slot.id),
        );
        return [ref.id, ref] as const;
      }),
    );
    const existingSnapshots = blockSnapshots.filter((item) => item.exists());
    const deleteSnapshots = existingSnapshots.filter(
      (item) => !targetRefs.has(item.id),
    );
    const atomicWriteCount = deleteSnapshots.length + template.slots.length + 3;
    if (atomicWriteCount > FIRESTORE_ATOMIC_WRITE_LIMIT) {
      throw new ApiError(
        409,
        "AGENDA_ATOMIC_WRITE_LIMIT_EXCEEDED",
        "El reemplazo excede el límite atómico de Firestore",
        {
          atomicWriteCount,
          atomicWriteLimit: FIRESTORE_ATOMIC_WRITE_LIMIT,
        },
      );
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + IDEMPOTENCY_TTL_MS);
    for (const existing of deleteSnapshots) {
      transaction.delete(existing.ref);
    }
    for (const slot of template.slots) {
      const blockRef = targetRefs.get(agendaBlockId(input.weekId, slot.id));
      if (!blockRef) {
        throw new Error(`No se pudo resolver el bloque ${slot.id}`);
      }
      transaction.set(blockRef, {
        userId: principal.trackerUserId,
        weekId: input.weekId,
        templateSlotId: slot.id,
        sourceTemplateRevision: template.revision,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.title,
        category: slot.category,
        ...(slot.activityId ? { activityId: slot.activityId } : {}),
        ...(slot.projectTag ? { projectTag: slot.projectTag } : {}),
        plannedStatus: "PLANNED",
        executedStatus: "PLANNED",
        complianceRate: 0,
        notes: slot.notes,
        createdBy: principal.actorId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const result = {
      ...weekApplyPlan(
        input,
        {
          template,
          currentWeekRevision,
          existing: preflight.existing,
          targetRefs,
          deleteCount: deleteSnapshots.length,
          atomicWriteCount,
        },
      ),
      dryRun: false,
      writes: true,
      currentWeekRevision,
      nextWeekRevision: currentWeekRevision + 1,
      deleteCount: deleteSnapshots.length,
      atomicWriteCount,
      appliedAt: now,
    };

    transaction.set(stateRef, {
      revision: currentWeekRevision + 1,
      weekId: input.weekId,
      timezone: AGENDA_TIME_ZONE,
      templateRevision: template.revision,
      blockIds: template.slots.map((slot) =>
        agendaBlockId(input.weekId, slot.id),
      ),
      updatedAt: now,
      updatedBy: principal.actorId,
    });
    transaction.set(auditRef, {
      actorId: principal.actorId,
      authMethod: principal.authMethod,
      action: "agenda.week.replaced_from_template",
      resourceType: "agenda_week",
      resourceId: input.weekId,
      requestId,
      result: "success",
      previousRevision: currentWeekRevision,
      revision: currentWeekRevision + 1,
      templateRevision: template.revision,
      deletedCount: deleteSnapshots.length,
      upsertedCount: template.slots.length,
      payloadHash: requestPayloadHash,
      createdAt: now,
    });
    transaction.set(idemRef, {
      operation: WEEK_APPLY_OPERATION,
      payloadHash: requestPayloadHash,
      resourceType: "agenda_week",
      resourceId: input.weekId,
      response: result,
      requestId,
      createdAt: now,
      completedAt: now,
      expiresAt,
    });

    return { replayed: false, result };
  });
}
