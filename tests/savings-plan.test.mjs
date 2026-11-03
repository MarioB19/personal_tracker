import assert from "node:assert/strict";
import test from "node:test";

import {
  computeMonthProgress,
  computePlanMonths,
  evaluateFinancialCut,
  legacyExpensesValues,
  normalizeFinancialCut,
  normalizeSavingsPlan,
  planToFirestoreData,
  repeatFromMonth,
  savingsPlanDocumentId,
  summarizePlanYear,
  summarizeProgress,
} from "../src/lib/planning/savings-plan.ts";

const months = (entries) => Array.from({ length: 12 }, (_, i) => entries[i] ?? 0);

test("a v1 plan keeps its monthly total as an undifferentiated expense line", () => {
  const plan = normalizeSavingsPlan(
    {
      initialSavings: 1000,
      incomeSources: [{ id: "a", name: "Sueldo", values: [100, 100] }],
      expensesValues: [40, 60],
    },
    2026,
  );

  assert.equal(plan.expenseLines.length, 1);
  assert.equal(plan.expenseLines[0].id, "legacy-expenses");
  assert.deepEqual(plan.expenseLines[0].values.slice(0, 3), [40, 60, 0]);
  assert.equal(plan.incomeSources[0].values.length, 12);
  assert.equal(plan.incomeSources[0].context, "PERSONAL");
  assert.equal(plan.incomeSources[0].kind, "RECURRING");
  assert.deepEqual(legacyExpensesValues(plan).slice(0, 2), [40, 60]);
});

test("an explicit empty v2 expense list is not replaced by legacy totals", () => {
  const plan = normalizeSavingsPlan(
    { expenseLines: [], expensesValues: [500] },
    2027,
  );
  assert.equal(plan.expenseLines.length, 0);
});

test("monthly math separates spend, reserved savings and free money", () => {
  const plan = normalizeSavingsPlan(
    {
      initialSavings: 10_000,
      incomeSources: [
        { id: "salary", name: "Sueldo", values: months({ 0: 50_000 }) },
        { id: "biz", name: "Ventas", values: months({ 0: 5_000 }), context: "BUSINESS" },
      ],
      expenseLines: [
        { id: "rent", name: "Renta", group: "PERSONAL", context: "PERSONAL", values: months({ 0: 15_000 }) },
        { id: "ads", name: "Pauta", group: "BUSINESS", context: "BUSINESS", values: months({ 0: 10_000 }) },
        { id: "trip", name: "Viaje", group: "ONE_OFF", context: "PERSONAL", values: months({ 0: 5_000 }) },
        { id: "card", name: "Tarjeta", group: "DEBT", context: "PERSONAL", values: months({ 0: 2_500 }) },
      ],
      savingsLines: [{ id: "fund", name: "Fondo", values: months({ 0: 20_000 }) }],
    },
    2027,
  );

  const [january] = computePlanMonths(plan);
  assert.equal(january.income, 55_000);
  assert.deepEqual(january.incomeByContext, { PERSONAL: 50_000, BUSINESS: 5_000 });
  assert.deepEqual(january.expensesByGroup, { PERSONAL: 15_000, BUSINESS: 10_000, ONE_OFF: 5_000, DEBT: 2_500 });
  assert.equal(january.spend, 32_500);
  assert.equal(january.net, 22_500);
  assert.equal(january.reserved, 20_000);
  assert.equal(january.free, 2_500);
  // El apartado sigue siendo tu dinero: el acumulado solo resta gastos.
  assert.equal(january.accumulated, 32_500);
  assert.equal(january.reservedAccumulated, 20_000);
});

test("a cut anchor restarts the projection from the real balance", () => {
  const plan = normalizeSavingsPlan(
    {
      initialSavings: 0,
      incomeSources: [{ id: "s", name: "Sueldo", values: Array(12).fill(1_000) }],
      expenseLines: [],
      anchor: { cutId: "2026-11-02", date: "2026-11-02", month: 10, balance: 125_000 },
    },
    2026,
  );
  const result = computePlanMonths(plan);
  assert.equal(result[9].accumulated, 10_000);
  assert.equal(result[9].anchored, false);
  assert.equal(result[10].accumulated, 126_000);
  assert.equal(result[10].anchored, true);
  assert.equal(result[11].accumulated, 127_000);

  const fromCut = summarizePlanYear(result, 10);
  assert.equal(fromCut.income, 2_000);
  assert.equal(fromCut.closing, 127_000);
});

test("invalid anchors and amounts are ignored safely", () => {
  const plan = normalizeSavingsPlan(
    {
      incomeSources: [{ id: "x", name: " ", values: ["12.345", "abc", null] }],
      anchor: { cutId: "c", month: 14, balance: 1 },
    },
    2026,
  );
  assert.equal(plan.anchor, null);
  assert.equal(plan.incomeSources[0].name, "Ingreso 1");
  assert.deepEqual(plan.incomeSources[0].values.slice(0, 3), [12.35, 0, 0]);
});

test("firestore payload keeps legacy readers working", () => {
  const plan = normalizeSavingsPlan(
    {
      incomeSources: [{ id: "s", name: "Sueldo", values: months({ 2: 300 }) }],
      expenseLines: [
        { id: "a", name: "A", group: "PERSONAL", context: "PERSONAL", values: months({ 2: 100 }) },
        { id: "b", name: "B", group: "BUSINESS", context: "BUSINESS", values: months({ 2: 50 }) },
      ],
      savingsLines: [{ id: "f", name: "Fondo", values: months({ 2: 1_000 }) }],
    },
    2026,
  );
  const payload = planToFirestoreData(plan, "brandon");
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.userId, "brandon");
  assert.equal(payload.expensesValues[2], 150);
  assert.equal(payload.expenseLines.length, 2);
  assert.equal(savingsPlanDocumentId("brandon", 2026), "brandon_2026");
});

test("repeatFromMonth copies a month forward without touching earlier months", () => {
  assert.deepEqual(
    repeatFromMonth(months({ 0: 5, 9: 7 }), 9),
    months({ 0: 5, 9: 7, 10: 7, 11: 7 }),
  );
});

test("cut checks compare declared totals with their line items", () => {
  const plan = normalizeSavingsPlan(
    {
      incomeSources: [
        { id: "astra", name: "Astra", values: months({ 10: 15_000 }) },
        { id: "red", name: "Red", values: months({ 10: 10_000 }) },
      ],
      expenseLines: [
        { id: "gym", name: "Gym", group: "PERSONAL", context: "PERSONAL", values: months({ 10: 600 }) },
      ],
    },
    2026,
  );
  const cut = normalizeFinancialCut(
    {
      date: "2026-11-02",
      accounts: [
        { id: "nu", name: "Nu", amount: 62_000 },
        { id: "didi", name: "Didi", amount: 10_000 },
      ],
      checks: [
        { id: "cash", label: "Dinero", declared: 72_000, terms: [{ kind: "accounts" }] },
        {
          id: "income",
          label: "Ingresos",
          declared: 25_500,
          terms: [
            { kind: "line", year: 2026, lineId: "astra", months: [10] },
            { kind: "line", year: 2026, lineId: "red", months: [10] },
          ],
        },
        {
          id: "free",
          label: "Libre",
          declared: 24_400,
          terms: [
            { kind: "line", year: 2026, lineId: "astra", months: [10] },
            { kind: "line", year: 2026, lineId: "red", months: [10] },
            { kind: "line", year: 2026, lineId: "gym", months: [10], sign: -1 },
          ],
        },
        { id: "tests", label: "Pauta", declared: 15_000, terms: [{ kind: "constant", value: 15_600, label: "3×1200" }], severity: "WARNING" },
        { id: "missing", label: "Falta", declared: 1, terms: [{ kind: "line", year: 2027, lineId: "nope", months: [0] }] },
      ],
    },
    "2026-11-02",
  );

  const results = Object.fromEntries(
    evaluateFinancialCut(cut, { 2026: plan }).map((item) => [item.id, item]),
  );
  assert.equal(results.cash.status, "OK");
  assert.equal(results.income.status, "MISMATCH");
  assert.equal(results.income.computed, 25_000);
  assert.equal(results.income.difference, -500);
  assert.equal(results.free.computed, 24_400);
  assert.equal(results.free.status, "OK");
  assert.equal(results.tests.status, "WARNING");
  assert.equal(results.missing.status, "MISSING");
  assert.deepEqual(results.missing.missing, ["2027:nope"]);
});

test("malformed cut terms are dropped instead of crashing the planner", () => {
  const cut = normalizeFinancialCut(
    {
      accounts: [{ name: "Nu", amount: 10 }],
      checks: [
        { id: "a", label: "A", declared: 5, terms: [{ kind: "line", year: 2026, lineId: "x" }, { kind: "accounts" }, null, { kind: "nope" }] },
        { id: "b", label: "B", declared: 1, terms: "bad" },
      ],
    },
    "c",
  );
  assert.equal(cut.checks.length, 1);
  assert.deepEqual(cut.checks[0].terms, [{ kind: "accounts", sign: 1 }]);
  const [result] = evaluateFinancialCut(cut, {});
  assert.equal(result.computed, 10);
});

test("month progress compares planned and real savings", () => {
  const plan = normalizeSavingsPlan(
    {
      initialSavings: 1_000,
      incomeSources: [{ id: "s", name: "Sueldo", values: Array(12).fill(10_000) }],
      expenseLines: [{ id: "e", name: "Gastos", group: "PERSONAL", context: "PERSONAL", values: Array(12).fill(6_000) }],
      actualSavingsValues: [5_000, 3_000],
    },
    2026,
  );
  const progress = computeMonthProgress(plan, computePlanMonths(plan), 2);
  assert.equal(progress[0].plan, 4_000);
  assert.equal(progress[0].status, "DONE");
  assert.equal(progress[0].difference, 1_000);
  assert.equal(progress[1].difference, -1_000);
  assert.equal(progress[2].status, "CURRENT");
  assert.equal(progress[3].status, "FUTURE");
  assert.equal(progress[1].realAccumulated, 9_000);
  assert.equal(progress[3].realAccumulated, null);
  const summary = summarizeProgress(progress);
  assert.deepEqual(
    { tracked: summary.trackedMonths, plan: summary.planToDate, real: summary.realToDate, diff: summary.difference },
    { tracked: 2, plan: 8_000, real: 8_000, diff: 0 },
  );
});

test("a past month without real savings is flagged as missing", () => {
  const plan = normalizeSavingsPlan({ incomeSources: [{ id: "s", name: "S", values: Array(12).fill(100) }] }, 2026);
  const progress = computeMonthProgress(plan, computePlanMonths(plan), 3);
  assert.equal(progress[0].status, "MISSING");
  assert.equal(progress[3].status, "CURRENT");
});

test("a past month with nothing planned and nothing saved is not flagged", () => {
  const plan = normalizeSavingsPlan(
    { incomeSources: [{ id: "s", name: "S", values: [0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100] }] },
    2026,
  );
  const progress = computeMonthProgress(plan, computePlanMonths(plan), 5);
  assert.equal(progress[0].status, "EMPTY");
  assert.equal(progress[2].status, "MISSING");
});

test("earmarked money counts as reserved from the cut, not as free money", () => {
  const plan = normalizeSavingsPlan(
    {
      initialSavings: 0,
      incomeSources: [{ id: "s", name: "Sueldo", values: Array(12).fill(1_000) }],
      savingsLines: [{ id: "f", name: "Fondo", values: Array(12).fill(100) }],
      anchor: { cutId: "c", date: "2026-11-02", month: 10, balance: 120_000 },
      earmarked: { label: " Fondo del coche ", amount: 120_000 },
    },
    2026,
  );
  assert.deepEqual(plan.earmarked, { label: "Fondo del coche", amount: 120_000 });
  const months = computePlanMonths(plan);
  assert.equal(months[9].reservedAccumulated, 1_000);
  assert.equal(months[10].accumulated, 121_000);
  assert.equal(months[10].reservedAccumulated, 120_100);
  assert.equal(months[11].reservedAccumulated, 120_200);
  assert.deepEqual(planToFirestoreData(plan, "brandon").earmarked, { label: "Fondo del coche", amount: 120_000 });
});

test("without a cut, earmarked money is reserved from january; zero or invalid is ignored", () => {
  const plan = normalizeSavingsPlan({ initialSavings: 180_000, earmarked: { label: "Coche", amount: 120_000 } }, 2027);
  assert.equal(computePlanMonths(plan)[0].reservedAccumulated, 120_000);
  assert.equal(normalizeSavingsPlan({ earmarked: { label: "x", amount: 0 } }, 2027).earmarked, null);
  assert.equal(normalizeSavingsPlan({ earmarked: "bad" }, 2027).earmarked, null);
});
