import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from "firebase/firestore";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const envText = await readFile(resolve(projectRoot, ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const weekId = process.env.TRACKER_AGENDA_DEDUPE_WEEK ?? "2026-W35";
if (!/^\d{4}-W\d{2}$/.test(weekId)) {
  throw new Error("TRACKER_AGENDA_DEDUPE_WEEK debe usar YYYY-Www");
}

const backupPath = resolve(
  projectRoot,
  process.env.TRACKER_AGENDA_BACKUP_PATH ??
    ".local-backups/agenda/agenda-before-routine-v2-2026-08-30.json",
);
const backupBody = await readFile(backupPath, "utf8");
const backup = JSON.parse(backupBody);
const backupBlocks = Array.isArray(backup.timeBlocks)
  ? backup.timeBlocks.filter((item) => item.weekId === weekId)
  : [];
if (backupBlocks.length === 0) {
  throw new Error(`El respaldo no contiene bloques para ${weekId}`);
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const trackerUserId = env.TRACKER_USER_ID || "brandon";
const collectionRef = collection(db, "users", trackerUserId, "timeBlocks");
const snapshot = await getDocs(collectionRef);
const weekDocuments = snapshot.docs
  .filter((item) => item.data().weekId === weekId)
  .map((item) => ({ id: item.id, data: item.data() }));

if (backupBlocks.length !== weekDocuments.length) {
  throw new Error(
    `El respaldo tiene ${backupBlocks.length} bloques y Firestore ${weekDocuments.length}; crea un respaldo nuevo antes de continuar`,
  );
}

function duplicateKey(item) {
  return [
    item.data.day,
    item.data.startTime,
    item.data.endTime,
    item.data.title,
  ].join("|");
}

const statusScore = {
  COMPLETED: 5,
  PARTIAL: 4,
  MOVED: 3,
  SKIPPED: 2,
  PLANNED: 1,
};

function keeperScore(item) {
  const status = statusScore[item.data.executedStatus] ?? 0;
  const compliance = Number(item.data.complianceRate) || 0;
  const notes = typeof item.data.notes === "string" ? item.data.notes.length : 0;
  return status * 1_000_000 + compliance * 1_000 + notes;
}

const groups = new Map();
for (const item of weekDocuments) {
  const key = duplicateKey(item);
  const group = groups.get(key) ?? [];
  group.push(item);
  groups.set(key, group);
}

const duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);
const categoryConflicts = duplicateGroups.filter(([, items]) => {
  const categories = new Set(items.map((item) => item.data.category));
  return categories.size > 1;
});
if (categoryConflicts.length > 0) {
  throw new Error(
    `Hay ${categoryConflicts.length} grupos con categorías distintas; se requiere revisión manual`,
  );
}

const toDelete = duplicateGroups.flatMap(([, items]) => {
  const sorted = [...items].sort(
    (a, b) => keeperScore(b) - keeperScore(a) || a.id.localeCompare(b.id),
  );
  return sorted.slice(1);
});

const summary = {
  mode:
    process.env.TRACKER_AGENDA_DEDUPE_CONFIRM === "DELETE_DUPLICATES"
      ? "execute"
      : "preview",
  weekId,
  before: weekDocuments.length,
  unique: groups.size,
  duplicateGroups: duplicateGroups.length,
  deleteCount: toDelete.length,
  after: weekDocuments.length - toDelete.length,
  backupPath,
  backupSha256: createHash("sha256").update(backupBody).digest("hex"),
};

if (summary.mode === "preview") {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

for (let index = 0; index < toDelete.length; index += 450) {
  const batch = writeBatch(db);
  for (const item of toDelete.slice(index, index + 450)) {
    batch.delete(doc(collectionRef, item.id));
  }
  await batch.commit();
}

console.log(JSON.stringify(summary, null, 2));
process.exit(0);
