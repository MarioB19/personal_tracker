import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalExpenseSeriesId,
  findActiveExpenseIdentityConflict,
  findCurrentExpenseBySeriesId,
  selectExpenseSeriesForIdentity,
} from "../src/lib/finance/expense-series.ts";

function expense(overrides = {}) {
  return {
    id: "expense",
    financialContext: "BUSINESS",
    type: "FIJO",
    name: "Hosting",
    month: "2026-08",
    ...overrides,
  };
}

test("una revisión explícita conserva precedencia sobre un timestamp legacy", () => {
  const legacy = expense({
    id: "legacy",
    updatedAt: { seconds: 1_800_000_000 },
  });
  const explicit = expense({
    id: "explicit",
    seriesId: canonicalExpenseSeriesId(legacy),
    effectiveFrom: "2026-09",
    month: "2026-09",
    revision: 1,
  });

  const selected = selectExpenseSeriesForIdentity(
    [legacy, explicit],
    expense({ id: "input", month: "2026-09" }),
  );
  assert.equal(selected.seed?.id, "explicit");
});

test("un nombre anterior crea otra serie si la original fue renombrada", () => {
  const canonicalHosting = canonicalExpenseSeriesId(expense());
  const records = [
    expense({
      id: "hosting-v1",
      seriesId: canonicalHosting,
      effectiveFrom: "2026-08",
      revision: 1,
    }),
    expense({
      id: "server-v2",
      seriesId: canonicalHosting,
      effectiveFrom: "2026-09",
      month: "2026-09",
      name: "Servidor",
      revision: 2,
    }),
  ];

  const selected = selectExpenseSeriesForIdentity(records, expense());
  assert.equal(selected.seed, undefined);
  assert.equal(selected.identitySeenHistorically, true);
  assert.notEqual(selected.seriesId, canonicalHosting);
});

test("una identidad cancelada se reactiva como generación independiente", () => {
  const canonicalHosting = canonicalExpenseSeriesId(expense());
  const cancelled = expense({
    id: "hosting-cancelled",
    seriesId: canonicalHosting,
    recurrenceStatus: "CANCELLED",
    effectiveFrom: "2026-09",
    month: "2026-09",
    revision: 2,
  });

  const selected = selectExpenseSeriesForIdentity([cancelled], expense());
  assert.equal(selected.seed, undefined);
  assert.equal(selected.identitySeenHistorically, true);
  assert.notEqual(selected.seriesId, canonicalHosting);
});

test("subscriptionStatus residual no cancela un gasto FIJO", () => {
  const fixedWithResidualStatus = expense({
    id: "hosting-fixed",
    seriesId: "hosting-series",
    subscriptionStatus: "cancelled",
    revision: 4,
  });

  const selected = selectExpenseSeriesForIdentity(
    [fixedWithResidualStatus],
    expense(),
  );
  assert.equal(selected.seed?.id, "hosting-fixed");

  const conflict = findActiveExpenseIdentityConflict(
    [fixedWithResidualStatus],
    expense(),
    "other-series",
  );
  assert.equal(conflict?.seriesId, "hosting-series");
});

test("recuerda una identidad histórica aunque su serie tenga un ID aleatorio", () => {
  const records = [
    expense({
      id: "hosting-v1",
      seriesId: "expense:random-ui-series",
      effectiveFrom: "2026-08",
      revision: 1,
    }),
    expense({
      id: "aws-v2",
      seriesId: "expense:random-ui-series",
      effectiveFrom: "2026-09",
      month: "2026-09",
      name: "AWS",
      revision: 2,
    }),
  ];

  const selected = selectExpenseSeriesForIdentity(records, expense());
  assert.equal(selected.seed, undefined);
  assert.equal(selected.identitySeenHistorically, true);
});

test("PATCH no adopta por identidad una serie explícita con otro ID", () => {
  const randomSeries = "expense:random-ui-series";
  const record = expense({ seriesId: randomSeries, revision: 5 });
  const canonical = canonicalExpenseSeriesId(record);

  assert.equal(findCurrentExpenseBySeriesId([record], randomSeries)?.id, record.id);
  assert.equal(findCurrentExpenseBySeriesId([record], canonical), undefined);
});

test("externalRef separa compromisos homónimos y permanece estable al renombrar", () => {
  const accountA = expense({ externalRef: "hosting:cuenta-A" });
  const accountB = expense({ externalRef: "hosting:cuenta-B" });
  assert.notEqual(
    canonicalExpenseSeriesId(accountA),
    canonicalExpenseSeriesId(accountB),
  );

  const stored = expense({
    id: "stored",
    name: "Hosting anterior",
    externalRef: "hosting:cuenta-A",
    seriesId: canonicalExpenseSeriesId(accountA),
    revision: 5,
  });
  const selected = selectExpenseSeriesForIdentity([stored], accountA);
  assert.equal(selected.seed?.id, "stored");
});

test("externalRef legado siempre produce un seriesId seguro y acotado", () => {
  const unsafe = expense({ externalRef: `${"x".repeat(260)}\ncontrol` });
  const seriesId = canonicalExpenseSeriesId(unsafe);

  assert.equal(seriesId.length <= 240, true);
  assert.equal(/[\u0000-\u001F\u007F]/.test(seriesId), false);
});

test("productId legado con controles también produce un seriesId reparable", () => {
  const seriesId = canonicalExpenseSeriesId(
    expense({ productId: "sku\n1" }),
  );

  assert.equal(seriesId.length <= 240, true);
  assert.equal(/[\u0000-\u001F\u007F]/.test(seriesId), false);
});

test("detecta un rename hacia la identidad de otra serie activa", () => {
  const records = [
    expense({
      id: "account-a",
      seriesId: "series-a",
      externalRef: "hosting:account-a",
      revision: 1,
    }),
    expense({
      id: "account-b",
      seriesId: "series-b",
      externalRef: "hosting:account-b",
      revision: 1,
    }),
  ];

  const conflict = findActiveExpenseIdentityConflict(
    records,
    expense({ externalRef: "hosting:account-a" }),
    "series-b",
  );
  assert.equal(conflict?.seriesId, "series-a");
});

test("un fijo anual homónimo no bloquea una recurrencia mensual", () => {
  const annual = expense({
    id: "annual",
    seriesId: "annual-series",
    frequency: "ANUAL",
    revision: 1,
  });
  const conflict = findActiveExpenseIdentityConflict(
    [annual],
    expense({ frequency: "MENSUAL" }),
    "monthly-series",
  );

  assert.equal(conflict, undefined);
});
