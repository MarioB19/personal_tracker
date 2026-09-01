import assert from "node:assert/strict";
import test from "node:test";

import { classifyBusinessHealth } from "../src/lib/finance/business-health.ts";

test("no marca verde un mes sin operación", () => {
  assert.deepEqual(
    classifyBusinessHealth({
      totalRevenue: 0,
      totalAdSpend: 0,
      netResult: 0,
      projectedClosingResult: 0,
    }),
    { status: "ATENCION", reason: "NO_OPERATION" },
  );
});

test("marca mal un mes sin operación que ya consume gastos fijos", () => {
  assert.deepEqual(
    classifyBusinessHealth({
      totalRevenue: 0,
      totalAdSpend: 0,
      netResult: -500,
      projectedClosingResult: -500,
    }),
    { status: "MAL", reason: "NO_OPERATION" },
  );
});

test("mantiene atención mientras el resultado actual o proyectado sea negativo", () => {
  assert.equal(
    classifyBusinessHealth({
      totalRevenue: 1_000,
      totalAdSpend: 400,
      netResult: -100,
      projectedClosingResult: 250,
    }).status,
    "ATENCION",
  );
  assert.equal(
    classifyBusinessHealth({
      totalRevenue: 1_000,
      totalAdSpend: 400,
      netResult: 100,
      projectedClosingResult: -50,
    }).status,
    "ATENCION",
  );
});

test("solo marca bien cuando hay operación, margen y resultados positivos", () => {
  assert.deepEqual(
    classifyBusinessHealth({
      totalRevenue: 1_500,
      totalAdSpend: 500,
      netResult: 700,
      projectedClosingResult: 1_200,
    }),
    { status: "BIEN", reason: "HEALTHY" },
  );
});
