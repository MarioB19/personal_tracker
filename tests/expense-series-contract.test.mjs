import assert from "node:assert/strict";
import test from "node:test";

import {
  expenseApiRecordSchema,
  expenseRecurrenceStatus,
  expenseSeriesMutationSchema,
  nextExpenseSeriesRevision,
} from "../src/contracts/expenses.ts";

function recurringExpense(overrides = {}) {
  return {
    name: "Hosting",
    amount: 599,
    category: "SERVICIOS",
    type: "SUSCRIPCION",
    frequency: "MENSUAL",
    chargeDay: 15,
    date: "2026-09-15",
    financialContext: "BUSINESS",
    subscriptionStatus: "active",
    isNecessity: true,
    notes: "Infraestructura",
    ...overrides,
  };
}

test("acepta una actualización mensual con control de revisión", () => {
  const parsed = expenseSeriesMutationSchema.parse({
    action: "UPDATE",
    seriesId: "legacy:BUSINESS:SUSCRIPCION:hosting:sinconcepto",
    effectiveFrom: "2026-09",
    expectedRevision: 4,
    expense: recurringExpense(),
  });

  assert.equal(parsed.action, "UPDATE");
  assert.equal(parsed.expectedRevision, 4);
});

test("rechaza cambios que no sean mensuales o cuya fecha no coincida", () => {
  const annual = expenseSeriesMutationSchema.safeParse({
    action: "UPDATE",
    seriesId: "series-1",
    effectiveFrom: "2026-09",
    expectedRevision: 1,
    expense: recurringExpense({ frequency: "ANUAL" }),
  });
  assert.equal(annual.success, false);

  const wrongMonth = expenseSeriesMutationSchema.safeParse({
    action: "UPDATE",
    seriesId: "series-1",
    effectiveFrom: "2026-10",
    expectedRevision: 1,
    expense: recurringExpense(),
  });
  assert.equal(wrongMonth.success, false);
});

test("acepta detener una serie y normaliza notas", () => {
  const parsed = expenseSeriesMutationSchema.parse({
    action: "STOP",
    seriesId: "series-1",
    effectiveFrom: "2026-10",
    expectedRevision: 7,
  });

  assert.equal(parsed.action, "STOP");
  assert.equal(parsed.notes, "");
});

test("una suscripción cancelada nunca se traduce como recurrencia activa", () => {
  assert.equal(
    expenseRecurrenceStatus({
      type: "SUSCRIPCION",
      subscriptionStatus: "cancelled",
    }),
    "CANCELLED",
  );
  assert.equal(
    expenseRecurrenceStatus({
      type: "SUSCRIPCION",
      subscriptionStatus: "active",
    }),
    "ACTIVE",
  );
});

test("la revisión API siempre supera una revisión Date.now creada por la UI", () => {
  assert.equal(nextExpenseSeriesRevision(1_800_000_000_000, 1_700_000_000_000), 1_800_000_000_001);
  assert.equal(nextExpenseSeriesRevision(7, 1_700_000_000_000), 1_700_000_000_000);
});

test("tolera montos legacy no positivos sin permitirlos en nuevas escrituras", () => {
  const legacy = expenseApiRecordSchema.safeParse({
    id: "legacy-zero",
    userId: "user-1",
    name: "Dato heredado",
    category: "OTRO",
    amount: 0,
    type: "VARIABLE",
    frequency: "UNICO",
    month: "2026-08",
    isNecessity: false,
    notes: "",
  });
  assert.equal(legacy.success, true);
});

test("rechaza productId con controles para no crear series imposibles de mutar", () => {
  const parsed = expenseSeriesMutationSchema.safeParse({
    action: "UPDATE",
    seriesId: "series-1",
    effectiveFrom: "2026-09",
    expectedRevision: 1,
    expense: recurringExpense({ productId: "sku\n1" }),
  });

  assert.equal(parsed.success, false);
});
