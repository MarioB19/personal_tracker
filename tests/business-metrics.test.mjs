import assert from "node:assert/strict";
import test from "node:test";

import {
  businessExpenseAppliesToMonth,
  calculateBusinessPosition,
  isVibeBusinessSummaryComplete,
  resolveCombinedBusinessFixedExpenses,
  resolveExpensesForMonth,
  resolveRecurringFixedExpenses,
  totalRecurringFixedExpenses,
  totalRecurringFixedExpensesForMonths,
} from "../src/lib/finance/business-metrics.ts";

test("solo un cierre Vibe final y sin fuentes incompletas se considera confirmado", () => {
  const completeQuality = {
    sources: [
      { id: "meta", status: "connected" },
      { id: "clicchat", status: "empty" },
      { id: "platform", status: "connected" },
    ],
    checks: Array.from({ length: 5 }, (_, index) => ({
      code: `CHECK_${index + 1}`,
      status: "PASS",
    })),
  };

  assert.equal(
    isVibeBusinessSummaryComplete({ status: "FINAL", quality: completeQuality }),
    true,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "PROVISIONAL",
      quality: completeQuality,
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: { ...completeQuality, checks: [] },
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: { ...completeQuality, checks: completeQuality.checks.slice(0, 1) },
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: {
        ...completeQuality,
        checks: [completeQuality.checks[0], completeQuality.checks[0]],
      },
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: {
        ...completeQuality,
        sources: completeQuality.sources.map((source) =>
          source.id === "platform"
            ? { ...source, status: "not_configured" }
            : source,
        ),
      },
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: { ...completeQuality, sources: completeQuality.sources.slice(0, 2) },
    }),
    false,
  );
  assert.equal(
    isVibeBusinessSummaryComplete({
      status: "FINAL",
      quality: {
        ...completeQuality,
        sources: [completeQuality.sources[0], ...completeQuality.sources],
      },
    }),
    false,
  );
});

test("los gastos fijos genéricos siguen activos en meses posteriores", () => {
  const fixedExpense = {
    month: "2026-08",
    type: "FIJO",
    frequency: "MENSUAL",
  };
  const oneOffExpense = {
    month: "2026-08",
    type: "VARIABLE",
    frequency: "UNICO",
  };

  assert.equal(businessExpenseAppliesToMonth(fixedExpense, "2026-07"), false);
  assert.equal(businessExpenseAppliesToMonth(fixedExpense, "2026-10"), true);
  assert.equal(businessExpenseAppliesToMonth(oneOffExpense, "2026-10"), false);
});

test("una suscripción cancelada deja de entrar al mes operativo", () => {
  assert.equal(
    businessExpenseAppliesToMonth(
      {
        month: "2026-08",
        type: "SUSCRIPCION",
        frequency: "MENSUAL",
        subscriptionStatus: "cancelled",
      },
      "2026-10",
    ),
    false,
  );
});

test("frecuencias semanales y anuales no se convierten en mensualidades", () => {
  for (const frequency of ["SEMANAL", "ANUAL"]) {
    assert.equal(
      businessExpenseAppliesToMonth(
        {
          month: "2026-08",
          type: "FIJO",
          frequency,
        },
        "2026-09",
      ),
      false,
    );
  }
});

test("una suscripción no mensual cancelada tampoco entra en su mes", () => {
  const expenses = [
    {
      id: "annual-cancelled",
      name: "Licencia anual",
      amount: 1200,
      category: "SUSCRIPCIONES",
      type: "SUSCRIPCION",
      frequency: "ANUAL",
      month: "2026-09",
      subscriptionStatus: "cancelled",
    },
  ];

  assert.deepEqual(resolveExpensesForMonth(expenses, "2026-09"), []);
});

test("un fijo anual no se convierte en compromiso mensual del runway", () => {
  const annualExpense = {
    id: "annual-license",
    name: "Licencia anual",
    amount: 12000,
    category: "SERVICIOS",
    type: "FIJO",
    frequency: "ANUAL",
    month: "2026-09",
    financialContext: "BUSINESS",
  };

  assert.equal(resolveExpensesForMonth([annualExpense], "2026-09").length, 1);
  const combined = resolveCombinedBusinessFixedExpenses(
    [],
    [annualExpense],
    "2026-09",
  );
  assert.deepEqual(combined.general, []);
  assert.equal(combined.periodOnly[0].id, "annual-license");
});

test("un monto legacy negativo nunca se convierte en ingreso implícito", () => {
  const resolved = resolveExpensesForMonth(
    [
      {
        id: "legacy-negative",
        name: "Dato heredado",
        amount: -500,
        category: "OTRO",
        type: "FIJO",
        frequency: "MENSUAL",
        month: "2026-08",
      },
    ],
    "2026-09",
  );

  assert.equal(resolved[0].amount, 0);
});

test("las copias genéricas mensuales se resuelven como una sola versión", () => {
  const expenses = [
    {
      id: "aug-hosting",
      name: "Hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      financialContext: "BUSINESS",
    },
    {
      id: "sep-hosting",
      name: "hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-09",
      financialContext: "BUSINESS",
    },
  ];

  const october = resolveExpensesForMonth(expenses, "2026-10");
  assert.equal(october.length, 1);
  assert.equal(october[0].id, "sep-hosting");
  assert.equal(october[0].amount, 650);
});

test("externalRef conserva dos compromisos reales con el mismo nombre", () => {
  const expenses = [
    {
      id: "hosting-a",
      name: "Hosting",
      amount: 100,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      externalRef: "hosting:cuenta-A",
      financialContext: "BUSINESS",
    },
    {
      id: "hosting-b",
      name: "Hosting",
      amount: 200,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      externalRef: "hosting:cuenta-B",
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveExpensesForMonth(expenses, "2026-09");
  assert.equal(resolved.length, 2);
  assert.equal(
    resolved.reduce((sum, expense) => sum + expense.amount, 0),
    300,
  );
});

test("externalRef evita que Health suprima un compromiso general homónimo", () => {
  const combined = resolveCombinedBusinessFixedExpenses(
    [
      {
        id: "health-hosting",
        userId: "user-1",
        concept: "Hosting",
        amount: 500,
        month: "2026-08",
        seriesId: "health-series",
        effectiveFrom: "2026-08",
        status: "ACTIVE",
        revision: 1,
      },
    ],
    [
      {
        id: "hosting-account-b",
        userId: "user-1",
        name: "Hosting",
        amount: 700,
        category: "SERVICIOS",
        type: "FIJO",
        frequency: "MENSUAL",
        month: "2026-08",
        financialContext: "BUSINESS",
        externalRef: "hosting:account-b",
        isNecessity: true,
        notes: "",
      },
    ],
    "2026-09",
  );

  assert.equal(combined.versioned.length, 1);
  assert.equal(combined.general.length, 1);
});

test("una cancelación genérica posterior no revive la suscripción anterior", () => {
  const expenses = [
    {
      id: "active",
      name: "CRM",
      amount: 400,
      category: "SUSCRIPCIONES",
      type: "SUSCRIPCION",
      frequency: "MENSUAL",
      month: "2026-08",
      subscriptionStatus: "active",
    },
    {
      id: "cancelled",
      name: "CRM",
      amount: 400,
      category: "SUSCRIPCIONES",
      type: "SUSCRIPCION",
      frequency: "MENSUAL",
      month: "2026-09",
      subscriptionStatus: "cancelled",
    },
  ];

  assert.deepEqual(resolveExpensesForMonth(expenses, "2026-10"), []);
});

test("editar y cancelar un gasto recurrente conserva su historial mensual", () => {
  const expenses = [
    {
      id: "hosting-v1",
      name: "Hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "expense:hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
    },
    {
      id: "hosting-v2",
      name: "Hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "expense:hosting",
      recurrenceStatus: "ACTIVE",
      revision: 2,
    },
    {
      id: "hosting-stop",
      name: "Hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-10",
      effectiveFrom: "2026-10",
      seriesId: "expense:hosting",
      recurrenceStatus: "CANCELLED",
      revision: 3,
    },
  ];

  assert.equal(resolveExpensesForMonth(expenses, "2026-08")[0].amount, 500);
  assert.equal(resolveExpensesForMonth(expenses, "2026-09")[0].amount, 650);
  assert.deepEqual(resolveExpensesForMonth(expenses, "2026-10"), []);
  assert.deepEqual(resolveExpensesForMonth(expenses, "2027-01"), []);
});

test("una serie que cambia de contexto solo aparece en su contexto vigente", () => {
  const expenses = [
    {
      id: "personal-v1",
      name: "Hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "expense:hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
      financialContext: "PERSONAL",
    },
    {
      id: "business-v2",
      name: "Hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "expense:hosting",
      recurrenceStatus: "ACTIVE",
      revision: 2,
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveExpensesForMonth(expenses, "2026-09");
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].financialContext, "BUSINESS");
  assert.equal(
    resolveCombinedBusinessFixedExpenses([], expenses, "2026-09").general[0]
      .id,
    "business-v2",
  );
});

test("el ledger versionado prevalece sobre un fijo genérico del mismo concepto", () => {
  const versioned = [
    fixed({
      id: "canonical",
      month: "2026-08",
      concept: "Hosting",
      amount: 700,
    }),
  ];
  const general = [
    {
      id: "generic",
      name: "hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-09",
  );
  assert.equal(resolved.versioned.length, 1);
  assert.equal(resolved.general.length, 0);
});

test("renombrar una serie canónica no revive el alias genérico anterior", () => {
  const versioned = [
    fixed({
      id: "hosting-v1",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "infra",
      concept: "Hosting",
      amount: 500,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "aws-v2",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "infra",
      concept: "AWS",
      amount: 500,
      status: "ACTIVE",
      revision: 2,
    }),
  ];
  const general = [
    {
      id: "generic-hosting",
      name: "Hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-09",
  );
  assert.equal(resolved.versioned[0].concept, "AWS");
  assert.deepEqual(resolved.general, []);
});

test("un alias renombrado permite una serie genérica nueva y posterior", () => {
  const versioned = [
    fixed({
      id: "hosting-v1",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "infra",
      concept: "Hosting",
      amount: 500,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "aws-v2",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "infra",
      concept: "AWS",
      amount: 500,
      status: "ACTIVE",
      revision: 2,
    }),
  ];
  const general = [
    {
      id: "new-hosting",
      name: "Hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-10",
      effectiveFrom: "2026-10",
      seriesId: "expense:new-hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-10",
  );
  assert.equal(resolved.versioned[0].concept, "AWS");
  assert.equal(resolved.general[0].id, "new-hosting");
});

test("una serie genérica reaparece cuando un alias se libera por segunda vez", () => {
  const versioned = [
    fixed({
      id: "hosting-aug",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "infra",
      concept: "Hosting",
      amount: 500,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "aws-sep",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "infra",
      concept: "AWS",
      amount: 500,
      status: "ACTIVE",
      revision: 2,
    }),
    fixed({
      id: "hosting-nov",
      month: "2026-11",
      effectiveFrom: "2026-11",
      seriesId: "infra",
      concept: "Hosting",
      amount: 550,
      status: "ACTIVE",
      revision: 3,
    }),
    fixed({
      id: "gcp-jan",
      month: "2027-01",
      effectiveFrom: "2027-01",
      seriesId: "infra",
      concept: "GCP",
      amount: 600,
      status: "ACTIVE",
      revision: 4,
    }),
  ];
  const general = [
    {
      id: "generic-hosting",
      name: "Hosting",
      amount: 650,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-10",
      effectiveFrom: "2026-10",
      seriesId: "expense:generic-hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
      financialContext: "BUSINESS",
    },
  ];

  assert.equal(
    resolveCombinedBusinessFixedExpenses(versioned, general, "2026-10")
      .general.length,
    1,
  );
  assert.equal(
    resolveCombinedBusinessFixedExpenses(versioned, general, "2026-11")
      .general.length,
    0,
  );
  assert.equal(
    resolveCombinedBusinessFixedExpenses(versioned, general, "2027-01")
      .general.length,
    1,
  );
});

test("cancelar el ledger versionado no revive su duplicado genérico", () => {
  const versioned = [
    fixed({
      id: "active",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 700,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "cancelled",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 0,
      status: "CANCELLED",
      revision: 2,
    }),
  ];
  const general = [
    {
      id: "generic",
      name: "hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      financialContext: "BUSINESS",
    },
  ];

  const resolved = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-09",
  );
  assert.deepEqual(resolved.versioned, []);
  assert.deepEqual(resolved.general, []);
});

test("un genérico posterior puede reactivarse sin revivir duplicados viejos", () => {
  const versioned = [
    fixed({
      id: "canonical-active",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 700,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "canonical-cancelled",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 0,
      status: "CANCELLED",
      revision: 2,
    }),
  ];
  const general = [
    {
      id: "old-duplicate",
      name: "hosting",
      amount: 500,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "expense:old-hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
      financialContext: "BUSINESS",
    },
    {
      id: "october-reactivation",
      name: "Hosting",
      amount: 600,
      category: "SERVICIOS",
      type: "FIJO",
      frequency: "MENSUAL",
      month: "2026-10",
      effectiveFrom: "2026-10",
      seriesId: "expense:reactivated-hosting",
      recurrenceStatus: "ACTIVE",
      revision: 1,
      financialContext: "BUSINESS",
    },
  ];

  const september = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-09",
  );
  assert.deepEqual(september.versioned, []);
  assert.deepEqual(september.general, []);

  const october = resolveCombinedBusinessFixedExpenses(
    versioned,
    general,
    "2026-10",
  );
  assert.deepEqual(october.versioned, []);
  assert.equal(october.general.length, 1);
  assert.equal(october.general[0].id, "october-reactivation");
  assert.equal(october.general[0].amount, 600);
});

function fixed(overrides) {
  return {
    id: overrides.id,
    userId: "user-1",
    month: overrides.month,
    concept: overrides.concept,
    amount: overrides.amount,
    ...overrides,
  };
}

test("un gasto fijo se repite desde su mes de inicio, pero no antes", () => {
  const expenses = [
    fixed({ id: "hosting", month: "2026-08", concept: "Hosting", amount: 500 }),
  ];

  assert.equal(totalRecurringFixedExpenses(expenses, "2026-07"), 0);
  assert.equal(totalRecurringFixedExpenses(expenses, "2026-08"), 500);
  assert.equal(totalRecurringFixedExpenses(expenses, "2027-01"), 500);
});

test("un monto fijo heredado negativo no reduce artificialmente el burn", () => {
  const expenses = [
    fixed({
      id: "invalid",
      month: "2026-08",
      concept: "Dato heredado inválido",
      amount: -500,
    }),
  ];

  assert.equal(totalRecurringFixedExpenses(expenses, "2026-09"), 0);
});

test("las copias heredadas del mismo concepto no se suman dos veces", () => {
  const expenses = [
    fixed({ id: "sep", month: "2026-09", concept: "ElevenLabs", amount: 300 }),
    fixed({ id: "aug", month: "2026-08", concept: "Eleven Labs", amount: 300 }),
  ];

  assert.equal(totalRecurringFixedExpenses(expenses, "2026-09"), 300);
});

test("la deduplicación heredada normaliza acentos, espacios y puntuación", () => {
  const expenses = [
    fixed({
      id: "sep",
      month: "2026-09",
      concept: "Suscripción CRM",
      amount: 450,
    }),
    fixed({
      id: "aug",
      month: "2026-08",
      concept: "suscripcion---crm",
      amount: 400,
    }),
  ];

  const resolved = resolveRecurringFixedExpenses(expenses, "2026-09");

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, "sep");
  assert.equal(resolved[0].amount, 450);
  assert.equal(resolved[0].resolvedSeriesId, "legacy:suscripcioncrm");
});

test("una revisión explícita gana a un timestamp legado en el mismo mes", () => {
  const expenses = [
    fixed({
      id: "legacy",
      month: "2026-09",
      concept: "Hosting",
      amount: 500,
      updatedAt: { seconds: 1_800_000_000, nanoseconds: 0 },
    }),
    fixed({
      id: "revision",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "legacy:hosting",
      concept: "Hosting",
      amount: 650,
      revision: 1,
      status: "ACTIVE",
    }),
  ];

  const resolved = resolveRecurringFixedExpenses(expenses, "2026-09");

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, "revision");
  assert.equal(resolved[0].amount, 650);
});

test("en el mismo mes gana la revisión más alta y puede cancelar la serie", () => {
  const expenses = [
    fixed({
      id: "active",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 500,
      revision: 1,
      status: "ACTIVE",
    }),
    fixed({
      id: "cancelled",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 0,
      revision: 2,
      status: "CANCELLED",
    }),
  ];

  assert.deepEqual(resolveRecurringFixedExpenses(expenses, "2026-09"), []);
  assert.equal(totalRecurringFixedExpenses(expenses, "2027-01"), 0);
});

test("una nueva versión reemplaza el monto y una cancelación corta el futuro", () => {
  const expenses = [
    fixed({
      id: "cancelled",
      month: "2026-11",
      effectiveFrom: "2026-11",
      seriesId: "software",
      concept: "Software",
      amount: 0,
      status: "CANCELLED",
      revision: 3,
    }),
    fixed({
      id: "new-price",
      month: "2026-10",
      effectiveFrom: "2026-10",
      seriesId: "software",
      concept: "Software",
      amount: 750,
      status: "ACTIVE",
      revision: 2,
    }),
    fixed({
      id: "original",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "software",
      concept: "Software",
      amount: 500,
      status: "ACTIVE",
      revision: 1,
    }),
  ];

  assert.equal(totalRecurringFixedExpenses(expenses, "2026-09"), 500);
  assert.equal(totalRecurringFixedExpenses(expenses, "2026-10"), 750);
  assert.equal(resolveRecurringFixedExpenses(expenses, "2026-11").length, 0);
  assert.equal(totalRecurringFixedExpenses(expenses, "2027-02"), 0);
});

test("una versión explícita no revive por una copia legacy posterior", () => {
  const expenses = [
    fixed({
      id: "legacy-april",
      month: "2026-04",
      concept: "Hosting",
      amount: 500,
    }),
    fixed({
      id: "cancel-march",
      month: "2026-03",
      effectiveFrom: "2026-03",
      seriesId: "legacy:hosting",
      concept: "Hosting",
      amount: 0,
      status: "CANCELLED",
      revision: 10,
    }),
    fixed({
      id: "legacy-february",
      month: "2026-02",
      concept: "Hosting",
      amount: 500,
    }),
  ];

  assert.equal(totalRecurringFixedExpenses(expenses, "2026-02"), 500);
  assert.equal(totalRecurringFixedExpenses(expenses, "2026-04"), 0);
  assert.equal(totalRecurringFixedExpenses(expenses, "2027-01"), 0);
});

test("una cancelación retroactiva posterior corta versiones futuras anteriores", () => {
  const expenses = [
    fixed({
      id: "original",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 500,
      status: "ACTIVE",
      revision: 1,
    }),
    fixed({
      id: "price-change",
      month: "2026-09",
      effectiveFrom: "2026-09",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 650,
      status: "ACTIVE",
      revision: 2,
    }),
    fixed({
      id: "backdated-cancellation",
      month: "2026-08",
      effectiveFrom: "2026-08",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 0,
      status: "CANCELLED",
      revision: 3,
    }),
  ];

  assert.deepEqual(resolveRecurringFixedExpenses(expenses, "2026-08"), []);
  assert.deepEqual(resolveRecurringFixedExpenses(expenses, "2026-09"), []);
  assert.deepEqual(resolveRecurringFixedExpenses(expenses, "2027-01"), []);
});

test("la suma anual resuelve cada mes de vigencia en vez de sumar documentos", () => {
  const expenses = [
    fixed({
      id: "hosting-v1",
      month: "2026-01",
      effectiveFrom: "2026-01",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 100,
      revision: 1,
      status: "ACTIVE",
    }),
    fixed({
      id: "hosting-v2",
      month: "2026-07",
      effectiveFrom: "2026-07",
      seriesId: "hosting",
      concept: "Hosting",
      amount: 200,
      revision: 2,
      status: "ACTIVE",
    }),
    fixed({
      id: "analytics",
      month: "2026-10",
      concept: "Analytics",
      amount: 50,
    }),
  ];
  const yearMonths = Array.from(
    { length: 12 },
    (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
  );

  // Hosting: 6 * 100 + 6 * 200. Analytics: 3 * 50.
  assert.equal(
    totalRecurringFixedExpensesForMonths(expenses, yearMonths),
    1_950,
  );
});

test("el runway usa el burn promedio cerrado y no un mes seleccionado", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [
      { month: "2026-06", netResult: -1_000, hasData: true },
      { month: "2026-07", netResult: -2_000, hasData: true },
      { month: "2026-08", netResult: -3_000, hasData: true },
    ],
    currentProjection: { month: "2026-09", netResult: 50_000, hasData: true },
    currentFixedCommitment: 500,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 2_000);
  assert.equal(position.runwayMonths, 5);
  assert.equal(position.status, "ATTENTION");
  assert.equal(position.burnSource, "TRAILING_AVERAGE");
});

test("selectedMonth no es parte del cálculo del runway general", () => {
  const input = {
    availableCash: 10_000,
    closedMonths: [
      { month: "2026-07", netResult: -2_000, hasData: true },
      { month: "2026-08", netResult: -2_000, hasData: true },
    ],
    currentFixedCommitment: 500,
    productTestCost: 1_000,
  };

  const augustView = calculateBusinessPosition({
    ...input,
    selectedMonth: "2026-08",
  });
  const januaryView = calculateBusinessPosition({
    ...input,
    selectedMonth: "2026-01",
  });

  assert.deepEqual(augustView, januaryView);
  assert.equal(augustView.runwayMonths, 5);
});

test("sin historial usa proyección actual y reserva tres meses de fijos para tests", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [],
    currentProjection: { month: "2026-09", netResult: -2_000, hasData: true },
    currentFixedCommitment: 1_000,
    productTestCost: 1_000,
  });

  assert.equal(position.runwayMonths, 5);
  assert.equal(position.reserveAmount, 3_000);
  assert.equal(position.capitalAvailableForTests, 7_000);
  assert.equal(position.possibleTests, 7);
});

test("una pérdida actual mayor domina un promedio histórico rentable", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [
      { month: "2026-06", netResult: 1_000, hasData: true },
      { month: "2026-07", netResult: 1_000, hasData: true },
      { month: "2026-08", netResult: 1_000, hasData: true },
    ],
    currentProjection: {
      month: "2026-09",
      netResult: -2_000,
      hasData: true,
    },
    currentFixedCommitment: 1_000,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 2_000);
  assert.equal(position.runwayMonths, 5);
  assert.equal(position.burnSource, "CURRENT_PROJECTION");
});

test("un mes actual incompleto usa los fijos como piso conservador", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [
      { month: "2026-08", netResult: 1_000, hasData: true },
    ],
    currentProjection: {
      month: "2026-09",
      netResult: -2_000,
      hasData: false,
    },
    currentFixedCommitment: 2_000,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 2_000);
  assert.equal(position.runwayMonths, 5);
  assert.equal(position.status, "ATTENTION");
  assert.equal(position.burnSource, "FIXED_COMMITMENT");
});

test("sin caja configurada no confunde ausencia de dato con caja agotada", () => {
  const position = calculateBusinessPosition({
    availableCash: 0,
    cashConfigured: false,
    closedMonths: [],
    currentFixedCommitment: 2_000,
    productTestCost: 1_000,
  });

  assert.equal(position.cashConfigured, false);
  assert.equal(position.status, "UNKNOWN");
  assert.equal(position.runwayMonths, null);
  assert.equal(position.possibleTests, 0);
});

test("distingue negocio sostenible de ausencia total de datos", () => {
  const sustainable = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [{ month: "2026-08", netResult: 500, hasData: true }],
    currentFixedCommitment: 0,
    productTestCost: 1_000,
  });
  const unknown = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [],
    currentFixedCommitment: 0,
    productTestCost: 1_000,
  });

  assert.equal(sustainable.status, "SUSTAINABLE");
  assert.equal(sustainable.runwayMonths, null);
  assert.equal(unknown.status, "UNKNOWN");
  assert.equal(unknown.monthlyBurn, null);
  assert.equal(unknown.runwayMonths, null);
  assert.equal(unknown.burnSource, "NONE");
});

test("sin operación usa el compromiso fijo: 10k entre 2k son cinco meses", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [],
    currentFixedCommitment: 2_000,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 2_000);
  assert.equal(position.runwayMonths, 5);
  assert.equal(position.status, "ATTENTION");
  assert.equal(position.burnSource, "FIXED_COMMITMENT");
});

test("capital agotado con burn produce cero meses de runway", () => {
  const position = calculateBusinessPosition({
    availableCash: -500,
    closedMonths: [{ month: "2026-08", netResult: -2_000, hasData: true }],
    currentFixedCommitment: 500,
    productTestCost: 1_000,
  });

  assert.equal(position.runwayMonths, 0);
  assert.equal(position.status, "CRITICAL");
  assert.equal(position.capitalAvailableForTests, 0);
  assert.equal(position.possibleTests, 0);
});

test("caja agotada nunca se presenta sostenible aunque el historial sea rentable", () => {
  const position = calculateBusinessPosition({
    availableCash: -1,
    closedMonths: [{ month: "2026-08", netResult: 2_000, hasData: true }],
    currentFixedCommitment: 0,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 0);
  assert.equal(position.runwayMonths, 0);
  assert.equal(position.status, "CRITICAL");
});

test("una proyección no finita se ignora y no produce runway NaN", () => {
  const position = calculateBusinessPosition({
    availableCash: 10_000,
    closedMonths: [],
    currentProjection: {
      month: "2026-09",
      netResult: Number.NaN,
      hasData: true,
    },
    currentFixedCommitment: 2_000,
    productTestCost: 1_000,
  });

  assert.equal(position.monthlyBurn, 2_000);
  assert.equal(position.runwayMonths, 5);
  assert.equal(position.burnSource, "FIXED_COMMITMENT");
});
