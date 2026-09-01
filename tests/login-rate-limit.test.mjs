import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLoginFailures,
  loginRateLimitStatus,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "../src/server/auth/login-rate-limit.ts";

test("bloquea el quinto intento fallido durante la ventana", () => {
  resetLoginRateLimitForTests();
  const key = "client-a";
  const now = 1_000;
  for (let index = 0; index < 4; index += 1) {
    assert.equal(recordLoginFailure(key, now).blocked, false);
  }
  const blocked = recordLoginFailure(key, now);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.retryAfterSeconds, 900);
});

test("expira la ventana y una sesión válida limpia los fallos", () => {
  resetLoginRateLimitForTests();
  const key = "client-b";
  recordLoginFailure(key, 1_000);
  assert.equal(loginRateLimitStatus(key, 901_001).blocked, false);

  recordLoginFailure(key, 1_000_000);
  clearLoginFailures(key);
  assert.equal(loginRateLimitStatus(key, 1_000_000).blocked, false);
});
