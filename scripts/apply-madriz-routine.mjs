import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const token = env.TRACKER_LOCAL_API_TOKEN;
if (!token) throw new Error("Run `npm run api:token` first.");

const mode = process.argv[2] ?? "preview";
if (!new Set(["preview", "apply"]).has(mode)) {
  throw new Error("Usa `preview` o `apply`");
}
if (
  mode === "apply" &&
  process.env.TRACKER_AGENDA_APPLY_CONFIRM !== "APPLY_MADRIZ_ROUTINE_V2"
) {
  throw new Error(
    "Define TRACKER_AGENDA_APPLY_CONFIRM=APPLY_MADRIZ_ROUTINE_V2 para escribir",
  );
}

const baseUrl = process.env.TRACKER_API_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseUrl);
if (!new Set(["127.0.0.1", "localhost", "::1", "[::1]"]).has(parsedBaseUrl.hostname)) {
  throw new Error("La aplicación de rutina solo puede ejecutarse contra loopback");
}

const routineData = JSON.parse(
  await readFile(
    resolve(projectRoot, "src/data/routines/madriz-v2.json"),
    "utf8",
  ),
);

function tupleToSlot(tuple) {
  const [id, day, startTime, endTime, title, category, projectTag] = tuple;
  return {
    id,
    day,
    startTime,
    endTime,
    title,
    category,
    ...(projectTag ? { projectTag } : {}),
    notes: "",
  };
}

const recurrentSlots = routineData.recurrent.map(tupleToSlot);
const week36Override = routineData.overrides["2026-W36"];
const replacedDays = new Set(week36Override.replaceDays);
const week36Slots = [
  ...recurrentSlots.filter((slot) => !replacedDays.has(slot.day)),
  ...week36Override.slots.map(tupleToSlot),
];
const timezone = routineData.timezone;
const weeks = [
  "2026-W36",
  "2026-W37",
  "2026-W38",
  "2026-W39",
  "2026-W40",
  "2026-W41",
  "2026-W42",
  "2026-W43",
  "2026-W44",
];

async function api(path, { method = "GET", body, idempotencyKey } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `${method} ${path} falló con ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload.data;
}

function assertPreview(name, result, expectedSlots) {
  if (result.writes !== false) throw new Error(`${name} intentaría escribir`);
  if (result.summary.slotCount !== expectedSlots) {
    throw new Error(
      `${name} esperaba ${expectedSlots} slots y recibió ${result.summary.slotCount}`,
    );
  }
  if (result.summary.totalMinutes !== 7 * 24 * 60) {
    throw new Error(`${name} no cubre exactamente 168 horas`);
  }
}

const previewWeek36 = await api("/api/v1/agenda/template/preview", {
  method: "POST",
  body: { timezone, slots: week36Slots },
});
assertPreview("W36", previewWeek36, week36Slots.length);
const previewRecurrent = await api("/api/v1/agenda/template/preview", {
  method: "POST",
  body: { timezone, slots: recurrentSlots },
});
assertPreview("plantilla recurrente", previewRecurrent, recurrentSlots.length);

if (mode === "preview") {
  const currentTemplate = await api("/api/v1/agenda/template");
  console.log(
    JSON.stringify(
      {
        mode,
        currentTemplateRevision: currentTemplate.revision,
        currentTemplateSlots: currentTemplate.slots.length,
        week36: previewWeek36.summary,
        recurrent: previewRecurrent.summary,
        targetWeeks: weeks,
        writes: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const statePath = resolve(
  projectRoot,
  ".local-backups/agenda/madriz-routine-v2-apply-state.json",
);
const state = {
  startedAt: new Date().toISOString(),
  routineVersion: routineData.version,
  targetWeeks: weeks,
  operations: [],
};

async function record(operation, result) {
  state.operations.push({ operation, completedAt: new Date().toISOString(), result });
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
}

const initialTemplate = await api("/api/v1/agenda/template");
const week36TemplateWrite = await api("/api/v1/agenda/template", {
  method: "PUT",
  idempotencyKey: "routine-v2-template-w36-20260831",
  body: {
    timezone,
    slots: week36Slots,
    expectedRevision: initialTemplate.revision,
  },
});
await record("template-w36", week36TemplateWrite);

const week36TemplateRevision = week36TemplateWrite.template.revision;
const week36Plan = await api("/api/v1/agenda/weeks/apply", {
  method: "POST",
  body: {
    weekId: "2026-W36",
    mode: "replace",
    dryRun: true,
    expectedTemplateRevision: week36TemplateRevision,
  },
});
if (!week36Plan.canApplyAtomically) {
  throw new Error("W36 excede el límite atómico de Firestore");
}
await record("preview-2026-W36", week36Plan);
const week36Apply = await api("/api/v1/agenda/weeks/apply", {
  method: "POST",
  idempotencyKey: "routine-v2-week-2026-W36-20260831",
  body: {
    weekId: "2026-W36",
    mode: "replace",
    dryRun: false,
    expectedTemplateRevision: week36TemplateRevision,
    expectedWeekRevision: week36Plan.currentWeekRevision,
  },
});
await record("apply-2026-W36", week36Apply);

const recurrentTemplateWrite = await api("/api/v1/agenda/template", {
  method: "PUT",
  idempotencyKey: "routine-v2-template-recurring-20260831",
  body: {
    timezone,
    slots: recurrentSlots,
    expectedRevision: week36TemplateRevision,
  },
});
await record("template-recurrent", recurrentTemplateWrite);
const recurrentTemplateRevision = recurrentTemplateWrite.template.revision;

for (const weekId of weeks.slice(1)) {
  const plan = await api("/api/v1/agenda/weeks/apply", {
    method: "POST",
    body: {
      weekId,
      mode: "replace",
      dryRun: true,
      expectedTemplateRevision: recurrentTemplateRevision,
    },
  });
  if (!plan.canApplyAtomically) {
    throw new Error(`${weekId} excede el límite atómico de Firestore`);
  }
  await record(`preview-${weekId}`, plan);
  const result = await api("/api/v1/agenda/weeks/apply", {
    method: "POST",
    idempotencyKey: `routine-v2-week-${weekId}-20260831`,
    body: {
      weekId,
      mode: "replace",
      dryRun: false,
      expectedTemplateRevision: recurrentTemplateRevision,
      expectedWeekRevision: plan.currentWeekRevision,
    },
  });
  await record(`apply-${weekId}`, result);
}

state.completedAt = new Date().toISOString();
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      mode,
      appliedWeeks: weeks,
      week36Slots: week36Slots.length,
      recurrentSlots: recurrentSlots.length,
      finalTemplateRevision: recurrentTemplateRevision,
      statePath,
    },
    null,
    2,
  ),
);
process.exit(0);
