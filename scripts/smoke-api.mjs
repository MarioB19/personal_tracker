import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const envText = await readFile(envPath, "utf8");
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

const baseUrl = process.env.TRACKER_API_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseUrl);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const isLoopback = loopbackHosts.has(parsedBaseUrl.hostname.toLowerCase());

if (!isLoopback) {
  if (process.env.TRACKER_API_ALLOW_REMOTE_SMOKE !== "true") {
    throw new Error(
      "TRACKER_API_BASE_URL debe usar loopback; define TRACKER_API_ALLOW_REMOTE_SMOKE=true para una prueba remota explícita.",
    );
  }
  if (parsedBaseUrl.protocol !== "https:") {
    throw new Error("Las pruebas remotas requieren HTTPS para proteger el token.");
  }
}

const authorization = { Authorization: `Bearer ${token}` };

async function expectStatus(label, request, expected) {
  const response = await request;
  if (response.status !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${response.status}`);
  }
  console.log(`${label}: ${response.status}`);
}

await expectStatus("health", fetch(`${baseUrl}/api/v1/health`), 200);
await expectStatus("me without token", fetch(`${baseUrl}/api/v1/me`), 401);
await expectStatus(
  "me",
  fetch(`${baseUrl}/api/v1/me`, { headers: authorization }),
  200,
);
await expectStatus(
  "dashboard summary",
  fetch(`${baseUrl}/api/v1/dashboard/summary`, { headers: authorization }),
  200,
);
await expectStatus(
  "dashboard invalid month",
  fetch(`${baseUrl}/api/v1/dashboard/summary?month=2026-99`, {
    headers: authorization,
  }),
  422,
);
await expectStatus(
  "expense list",
  fetch(`${baseUrl}/api/v1/finance/expenses?limit=1`, {
    headers: authorization,
  }),
  200,
);
await expectStatus(
  "expense list invalid month",
  fetch(`${baseUrl}/api/v1/finance/expenses?month=2026-00`, {
    headers: authorization,
  }),
  422,
);
await expectStatus(
  "expense preview",
  fetch(`${baseUrl}/api/v1/finance/expenses/preview`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Validación local (no se guarda)",
      amount: 1,
      category: "OTRO",
      type: "VARIABLE",
      frequency: "UNICO",
      date: new Date().toISOString().slice(0, 10),
      financialContext: "PERSONAL",
      isNecessity: false,
      notes: "Smoke test de previsualización",
    }),
  }),
  200,
);
await expectStatus(
  "expense preview with large two-decimal amount",
  fetch(`${baseUrl}/api/v1/finance/expenses/preview`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Validación monetaria grande (no se guarda)",
      amount: 78_190_065.32,
      date: new Date().toISOString().slice(0, 10),
    }),
  }),
  200,
);
await expectStatus(
  "expense preview with more than two decimals",
  fetch(`${baseUrl}/api/v1/finance/expenses/preview`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Monto con tres decimales",
      amount: 1.001,
      date: new Date().toISOString().slice(0, 10),
    }),
  }),
  422,
);
await expectStatus(
  "invalid expense preview",
  fetch(`${baseUrl}/api/v1/finance/expenses/preview`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Monto inválido",
      amount: -1,
      date: new Date().toISOString().slice(0, 10),
    }),
  }),
  422,
);
await expectStatus(
  "expense write without idempotency key",
  fetch(`${baseUrl}/api/v1/finance/expenses`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: "{}",
  }),
  400,
);

console.log("API smoke test passed; no Firestore writes were performed.");
