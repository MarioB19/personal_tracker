const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

// 1. Parse .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const firstEq = trimmed.indexOf("=");
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    const val = trimmed.substring(firstEq + 1).replace(/^['"]|['"]$/g, "").trim();
    process.env[key] = val;
  });
}

// 2. Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Error: NEXT_PUBLIC_FIREBASE_API_KEY no se encontró en .env.local");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Command Line Arguments
const userId = process.argv[2];
const targetWeekId = process.argv[3]; // Opcional

if (!userId) {
  console.log("\n=======================================================");
  console.log("  Depurador de Duplicados en Firestore - Routine Tracker");
  console.log("=======================================================");
  console.log("Uso: node scratch/cleanup_duplicates.js <userId> [weekId]");
  console.log("Ejemplos:");
  console.log("  - Limpiar duplicados de todo el historial:");
  console.log("    node scratch/cleanup_duplicates.js TU_USER_ID\n");
  console.log("  - Limpiar duplicados de una semana específica:");
  console.log("    node scratch/cleanup_duplicates.js TU_USER_ID 2026-W23");
  console.log("=======================================================\n");
  process.exit(0);
}

async function run() {
  console.log(`\nIniciando depuración de duplicados para el usuario: ${userId}...`);
  if (targetWeekId) {
    console.log(`Filtro de semana activa: ${targetWeekId}`);
  }

  try {
    const colRef = collection(db, "users", userId, "timeBlocks");
    const snapshot = await getDocs(colRef);
    const docsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Se encontraron ${docsList.length} bloques totales en tu base de datos.`);

    const seen = new Set();
    const duplicates = [];

    docsList.forEach(b => {
      // Si se especifica semana, ignorar bloques de otras semanas
      if (targetWeekId && b.weekId !== targetWeekId) return;

      const key = `${b.weekId || ""}-${b.day}-${b.startTime}-${b.endTime}-${b.title}`;
      if (seen.has(key)) {
        duplicates.push(b);
      } else {
        seen.add(key);
      }
    });

    if (duplicates.length === 0) {
      console.log("¡Excelente! No se encontraron bloques duplicados en tu base de datos.");
      process.exit(0);
    }

    console.log(`\n[!] ¡Se detectaron ${duplicates.length} bloques duplicados!`);
    console.log("Eliminando duplicados de Firestore...");

    let deletedCount = 0;
    for (const b of duplicates) {
      const docRef = doc(db, "users", userId, "timeBlocks", b.id);
      await deleteDoc(docRef);
      console.log(`[-] Eliminado duplicado de: "${b.title}" (${b.day} · ${b.startTime} - ${b.endTime} · Semana: ${b.weekId})`);
      deletedCount++;
    }

    console.log(`\n[+] ¡Limpieza completada! Se eliminaron con éxito ${deletedCount} bloques duplicados de Firestore.\n`);
  } catch (error) {
    console.error("Error durante la limpieza de duplicados:", error);
  }
}

run();
