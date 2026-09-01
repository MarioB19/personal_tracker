import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebSessionToken,
  verifyWebSessionToken,
} from "../src/server/auth/session-token.ts";

const SECRET = "test-session-secret-with-more-than-32-characters";
const NOW = Date.parse("2026-08-31T20:00:00-06:00");

test("firma y valida una sesión no expirada", () => {
  const token = createWebSessionToken("brandon", SECRET, NOW, 60);
  const session = verifyWebSessionToken(token, SECRET, NOW + 30_000);
  assert.equal(session?.userId, "brandon");
});
test("rechaza sesión alterada, secreto distinto y expiración", () => {
  const token = createWebSessionToken("brandon", SECRET, NOW, 60);
  assert.equal(verifyWebSessionToken(`${token}x`, SECRET, NOW), null);
  assert.equal(
    verifyWebSessionToken(token, `${SECRET}-different`, NOW),
    null,
  );
  assert.equal(verifyWebSessionToken(token, SECRET, NOW + 61_000), null);
});
