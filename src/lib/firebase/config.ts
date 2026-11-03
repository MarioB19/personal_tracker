import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only once
const isFirstInitialization = getApps().length === 0;
const app = isFirstInitialization ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Local sandbox: `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8085` routes
 * every read and write to the Firestore Emulator. Only `demo-*` projects are
 * accepted so an emulator session can never be mixed with real credentials.
 */
const emulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST?.trim();
if (emulatorHost && isFirstInitialization) {
  if (!firebaseConfig.projectId?.startsWith("demo-")) {
    throw new Error(
      "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST requiere un proyecto demo-*",
    );
  }
  const [host, port] = emulatorHost.split(":");
  connectFirestoreEmulator(db, host, Number(port));
}

export default app;
