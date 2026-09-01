import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
} from "firebase/firestore";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const envPath = resolve(projectRoot, ".env.local");
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

const requiredFirebaseKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

for (const key of requiredFirebaseKeys) {
  if (!env[key]) throw new Error(`Falta ${key} en .env.local`);
}

const requestedWeeks = (process.env.TRACKER_AGENDA_BACKUP_WEEKS ?? "2026-W35:2026-W44")
  .split(":");
if (requestedWeeks.length !== 2) {
  throw new Error("TRACKER_AGENDA_BACKUP_WEEKS debe usar inicio:fin");
}

const [firstWeek, lastWeek] = requestedWeeks;
const weekPattern = /^\d{4}-W\d{2}$/;
if (!weekPattern.test(firstWeek) || !weekPattern.test(lastWeek)) {
  throw new Error("Las semanas deben usar formato YYYY-Www");
}

const trackerUserId = env.TRACKER_USER_ID || "brandon";
const outputPath = resolve(
  projectRoot,
  process.env.TRACKER_AGENDA_BACKUP_PATH ??
    `.local-backups/agenda/agenda-before-routine-v2-${new Date()
      .toISOString()
      .replaceAll(":", "-")}.json`,
);

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);

function serialize(value) {
  if (value instanceof Date) return { __type: "date", iso: value.toISOString() };
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return { __type: "timestamp", iso: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)]),
    );
  }
  return value;
}

const templateSnapshot = await getDoc(doc(db, "weekly_templates", trackerUserId));
const timeBlocksSnapshot = await getDocs(
  collection(db, "users", trackerUserId, "timeBlocks"),
);
const timeBlocks = timeBlocksSnapshot.docs
  .map((item) => ({ id: item.id, ...item.data() }))
  .filter(
    (item) =>
      typeof item.weekId === "string" &&
      item.weekId >= firstWeek &&
      item.weekId <= lastWeek,
  )
  .sort(
    (a, b) =>
      a.weekId.localeCompare(b.weekId) ||
      String(a.day).localeCompare(String(b.day)) ||
      String(a.startTime).localeCompare(String(b.startTime)) ||
      a.id.localeCompare(b.id),
  );

const backup = serialize({
  formatVersion: 1,
  createdAt: new Date(),
  firebaseProjectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  trackerUserId,
  scope: { firstWeek, lastWeek },
  template: templateSnapshot.exists()
    ? { exists: true, id: templateSnapshot.id, data: templateSnapshot.data() }
    : { exists: false, id: trackerUserId, data: null },
  timeBlocks,
});
const body = `${JSON.stringify(backup, null, 2)}\n`;
const sha256 = createHash("sha256").update(body).digest("hex");

await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
await writeFile(outputPath, body, { mode: 0o600 });

console.log(
  JSON.stringify(
    {
      outputPath,
      sha256,
      templateExists: templateSnapshot.exists(),
      templateSlots: templateSnapshot.exists()
        ? (templateSnapshot.data().slots?.length ?? 0)
        : 0,
      timeBlocks: timeBlocks.length,
      scope: { firstWeek, lastWeek },
    },
    null,
    2,
  ),
);
process.exit(0);
