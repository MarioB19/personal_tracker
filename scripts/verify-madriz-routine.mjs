import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const envText = await readFile(resolve(projectRoot, ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const requiredFirebaseKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

for (const key of requiredFirebaseKeys) {
  if (!env[key]) throw new Error(`Falta ${key} en .env.local`);
}

const routineData = JSON.parse(
  await readFile(
    resolve(projectRoot, "src/data/routines/madriz-v2.json"),
    "utf8",
  ),
);
const trackerUserId = env.TRACKER_USER_ID || "brandon";
const recurrentWeekIds = [
  "2026-W37",
  "2026-W38",
  "2026-W39",
  "2026-W40",
  "2026-W41",
  "2026-W42",
  "2026-W43",
  "2026-W44",
];
const inspectedWeekIds = ["2026-W35", "2026-W36", ...recurrentWeekIds];
const MAX_REPORTED_ISSUES = 100;
const issues = [];
let issueCount = 0;

function addIssue(code, message, details = undefined) {
  issueCount += 1;
  if (issues.length < MAX_REPORTED_ISSUES) {
    issues.push({ code, message, ...(details ? { details } : {}) });
  }
}

function tupleToSlot(tuple) {
  const [id, day, startTime, endTime, title, category, projectTag] = tuple;
  return {
    id,
    day,
    startTime,
    endTime,
    title,
    category,
    activityId: null,
    projectTag: projectTag ?? null,
    notes: "",
  };
}

function comparableSlot(value) {
  return {
    id: value.id,
    day: value.day,
    startTime: value.startTime,
    endTime: value.endTime,
    title: value.title,
    category: value.category,
    activityId: value.activityId ?? null,
    projectTag: value.projectTag ?? null,
    notes: value.notes ?? "",
  };
}

function agendaBlockId(weekId, slotId) {
  return `agenda_${weekId.replace("-", "_")}_${slotId}`;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareTemplate(actualData, expectedSlots) {
  if (!actualData) {
    addIssue("TEMPLATE_MISSING", "No existe la plantilla semanal recurrente");
    return;
  }

  if (actualData.timezone !== routineData.timezone) {
    addIssue(
      "TEMPLATE_TIMEZONE_MISMATCH",
      `La plantilla usa ${String(actualData.timezone)} y se esperaba ${routineData.timezone}`,
    );
  }

  const actualSlots = Array.isArray(actualData.slots) ? actualData.slots : [];
  if (!Array.isArray(actualData.slots)) {
    addIssue("TEMPLATE_SLOTS_INVALID", "template.slots no es un arreglo");
  }
  if (actualSlots.length !== 89) {
    addIssue(
      "TEMPLATE_SLOT_COUNT",
      `La plantilla tiene ${actualSlots.length} slots y se esperaban 89`,
    );
  }

  const actualById = new Map();
  for (const slot of actualSlots) {
    if (typeof slot?.id !== "string") {
      addIssue("TEMPLATE_SLOT_ID_INVALID", "Hay un slot sin ID estable", { slot });
      continue;
    }
    if (actualById.has(slot.id)) {
      addIssue(
        "TEMPLATE_SLOT_ID_DUPLICATE",
        `El ID ${slot.id} está duplicado en la plantilla`,
      );
    }
    actualById.set(slot.id, slot);
  }

  const expectedById = new Map(expectedSlots.map((slot) => [slot.id, slot]));
  for (const [slotId, expected] of expectedById) {
    const actual = actualById.get(slotId);
    if (!actual) {
      addIssue(
        "TEMPLATE_SLOT_MISSING",
        `Falta el slot ${slotId} en la plantilla`,
      );
      continue;
    }
    const comparableActual = comparableSlot(actual);
    if (!sameValue(comparableActual, expected)) {
      addIssue(
        "TEMPLATE_SLOT_MISMATCH",
        `El slot ${slotId} no coincide con madriz-v2.json`,
        { expected, actual: comparableActual },
      );
    }
  }
  for (const slotId of actualById.keys()) {
    if (!expectedById.has(slotId)) {
      addIssue(
        "TEMPLATE_SLOT_UNEXPECTED",
        `La plantilla contiene el slot no esperado ${slotId}`,
      );
    }
  }
}

function compareAppliedWeek(weekId, actualDocuments, expectedSlots) {
  const expectedCount = weekId === "2026-W36" ? 94 : 89;
  if (actualDocuments.length !== expectedCount) {
    addIssue(
      "WEEK_DOCUMENT_COUNT",
      `${weekId} tiene ${actualDocuments.length} documentos y se esperaban ${expectedCount}`,
    );
  }

  const actualByDocumentId = new Map(
    actualDocuments.map((item) => [item.id, item.data]),
  );
  for (const expectedSlot of expectedSlots) {
    const expectedDocumentId = agendaBlockId(weekId, expectedSlot.id);
    const actual = actualByDocumentId.get(expectedDocumentId);
    if (!actual) {
      addIssue(
        "WEEK_SLOT_MISSING",
        `${weekId} no contiene ${expectedDocumentId}`,
      );
      continue;
    }

    const expected = {
      weekId,
      templateSlotId: expectedSlot.id,
      ...expectedSlot,
    };
    const comparableActual = {
      weekId: actual.weekId,
      templateSlotId: actual.templateSlotId,
      ...comparableSlot({ id: actual.templateSlotId, ...actual }),
    };
    if (!sameValue(comparableActual, expected)) {
      addIssue(
        "WEEK_SLOT_MISMATCH",
        `${expectedDocumentId} no coincide con madriz-v2.json`,
        { expected, actual: comparableActual },
      );
    }
  }

  const expectedDocumentIds = new Set(
    expectedSlots.map((slot) => agendaBlockId(weekId, slot.id)),
  );
  for (const documentId of actualByDocumentId.keys()) {
    if (!expectedDocumentIds.has(documentId)) {
      addIssue(
        "WEEK_DOCUMENT_UNEXPECTED",
        `${weekId} contiene el documento no esperado ${documentId}`,
      );
    }
  }
}

function verifyWeek35(actualDocuments) {
  if (actualDocuments.length !== 76) {
    addIssue(
      "W35_DOCUMENT_COUNT",
      `2026-W35 tiene ${actualDocuments.length} documentos y se esperaban 76`,
    );
  }

  const groups = new Map();
  for (const item of actualDocuments) {
    const key = [
      item.data.day,
      item.data.startTime,
      item.data.endTime,
      item.data.title,
    ].join("|");
    const ids = groups.get(key) ?? [];
    ids.push(item.id);
    groups.set(key, ids);
  }

  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      addIssue(
        "W35_DUPLICATE",
        `2026-W35 repite ${key} en ${ids.length} documentos`,
        { documentIds: ids },
      );
    }
  }
}

function verifyTitlePolicy(label, records) {
  const forbiddenTitle = /\b(?:nowya|voluntred|red)\b/i;
  for (const record of records) {
    const title = typeof record.title === "string" ? record.title : "";
    if (forbiddenTitle.test(title)) {
      addIssue(
        "FORBIDDEN_TITLE",
        `${label} contiene el título prohibido “${title}”`,
      );
    }
    if (/landings?/i.test(title) && title !== "Madriz — Landings") {
      addIssue(
        "LANDING_TITLE_INVALID",
        `${label} contiene “${title}”; debe ser exactamente “Madriz — Landings”`,
      );
    }
  }
}

const recurrentSlots = routineData.recurrent.map(tupleToSlot);
const week36Override = routineData.overrides?.["2026-W36"];
if (!week36Override || !Array.isArray(week36Override.slots)) {
  throw new Error("madriz-v2.json no contiene el override 2026-W36");
}
const replacedDays = new Set(week36Override.replaceDays);
const week36Slots = [
  ...recurrentSlots.filter((slot) => !replacedDays.has(slot.day)),
  ...week36Override.slots.map(tupleToSlot),
];

if (recurrentSlots.length !== 89) {
  addIssue(
    "CANONICAL_RECURRENT_COUNT",
    `madriz-v2.json contiene ${recurrentSlots.length} slots recurrentes y se esperaban 89`,
  );
}
if (week36Slots.length !== 94) {
  addIssue(
    "CANONICAL_W36_COUNT",
    `El override compuesto de W36 contiene ${week36Slots.length} slots y se esperaban 94`,
  );
}

const app = initializeApp(
  {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  `verify-madriz-routine-${Date.now()}`,
);
const db = getFirestore(app);

try {
  const timeBlocksRef = collection(db, "users", trackerUserId, "timeBlocks");
  const [templateSnapshot, ...weekSnapshots] = await Promise.all([
    getDoc(doc(db, "weekly_templates", trackerUserId)),
    ...inspectedWeekIds.map((weekId) =>
      getDocs(query(timeBlocksRef, where("weekId", "==", weekId))),
    ),
  ]);
  const documentsByWeek = new Map(
    inspectedWeekIds.map((weekId, index) => [
      weekId,
      weekSnapshots[index].docs.map((item) => ({
        id: item.id,
        data: item.data(),
      })),
    ]),
  );

  compareTemplate(
    templateSnapshot.exists() ? templateSnapshot.data() : null,
    recurrentSlots,
  );
  verifyWeek35(documentsByWeek.get("2026-W35") ?? []);
  compareAppliedWeek(
    "2026-W36",
    documentsByWeek.get("2026-W36") ?? [],
    week36Slots,
  );
  for (const weekId of recurrentWeekIds) {
    compareAppliedWeek(
      weekId,
      documentsByWeek.get(weekId) ?? [],
      recurrentSlots,
    );
  }

  const currentTemplateSlots = templateSnapshot.exists()
    ? (templateSnapshot.data().slots ?? [])
    : [];
  verifyTitlePolicy("la plantilla recurrente", currentTemplateSlots);
  for (const weekId of ["2026-W36", ...recurrentWeekIds]) {
    verifyTitlePolicy(
      weekId,
      (documentsByWeek.get(weekId) ?? []).map((item) => item.data),
    );
  }

  const week36WaLaunchCount = (documentsByWeek.get("2026-W36") ?? []).filter(
    (item) => /WA lanzamiento/i.test(String(item.data.title ?? "")),
  ).length;
  if (week36WaLaunchCount !== 3) {
    addIssue(
      "W36_WA_LAUNCH_COUNT",
      `2026-W36 contiene ${week36WaLaunchCount} slots WA lanzamiento y se esperaban 3`,
    );
  }
  for (const weekId of recurrentWeekIds) {
    const waLaunchCount = (documentsByWeek.get(weekId) ?? []).filter((item) =>
      /WA lanzamiento/i.test(String(item.data.title ?? "")),
    ).length;
    if (waLaunchCount !== 0) {
      addIssue(
        "FUTURE_WA_LAUNCH_COUNT",
        `${weekId} contiene ${waLaunchCount} slots WA lanzamiento y se esperaban 0`,
      );
    }
  }

  const result = {
    ok: issueCount === 0,
    readOnly: true,
    firebaseProjectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    trackerUserId,
    routineVersion: routineData.version,
    template: {
      exists: templateSnapshot.exists(),
      revision: templateSnapshot.exists()
        ? (templateSnapshot.data().revision ?? 0)
        : null,
      expectedSlots: 89,
      actualSlots: currentTemplateSlots.length,
    },
    weeks: Object.fromEntries(
      inspectedWeekIds.map((weekId) => [
        weekId,
        {
          expectedDocuments:
            weekId === "2026-W35" ? 76 : weekId === "2026-W36" ? 94 : 89,
          actualDocuments: (documentsByWeek.get(weekId) ?? []).length,
        },
      ]),
    ),
    titlePolicyScope: ["weekly_templates", "2026-W36:2026-W44"],
    waLaunch: {
      "2026-W36": week36WaLaunchCount,
      futureWeeks: Object.fromEntries(
        recurrentWeekIds.map((weekId) => [
          weekId,
          (documentsByWeek.get(weekId) ?? []).filter((item) =>
            /WA lanzamiento/i.test(String(item.data.title ?? "")),
          ).length,
        ]),
      ),
    },
    issueCount,
    issues,
    ...(issueCount > issues.length
      ? { omittedIssueCount: issueCount - issues.length }
      : {}),
  };

  console.log(JSON.stringify(result, null, 2));
  await deleteApp(app);
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  await deleteApp(app);
  console.error(
    JSON.stringify(
      {
        ok: false,
        readOnly: true,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
