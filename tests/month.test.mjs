import assert from "node:assert/strict";
import test from "node:test";

import {
  dateInMexicoCity,
  isMonthKey,
  monthInMexicoCity,
} from "../src/lib/time/month.ts";

test("calcula el mes con zona America/Mexico_City", () => {
  assert.equal(
    monthInMexicoCity(new Date("2026-09-01T04:30:00.000Z")),
    "2026-08",
  );
});

test("calcula la fecha de calendario en CDMX y no en UTC", () => {
  assert.equal(
    dateInMexicoCity(new Date("2026-09-01T04:30:00.000Z")),
    "2026-08-31",
  );
});

test("valida claves mensuales estrictas", () => {
  assert.equal(isMonthKey("2026-08"), true);
  assert.equal(isMonthKey("2026-8"), false);
  assert.equal(isMonthKey("2026-13"), false);
});
