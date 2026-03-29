import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Generic helpers for Firestore CRUD operations scoped to a user

function userCollection(userId: string, collectionName: string) {
  return collection(db, "users", userId, collectionName);
}

function userDoc(userId: string, collectionName: string, docId: string) {
  return doc(db, "users", userId, collectionName, docId);
}

export async function getAll<T>(userId: string, collectionName: string): Promise<T[]> {
  const q = query(
    userCollection(userId, collectionName),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function getById<T>(
  userId: string,
  collectionName: string,
  docId: string
): Promise<T | null> {
  const snap = await getDoc(userDoc(userId, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function getFiltered<T>(
  userId: string,
  collectionName: string,
  field: string,
  value: string | number | boolean
): Promise<T[]> {
  const q = query(
    userCollection(userId, collectionName),
    where(field, "==", value),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function create<T extends DocumentData>(
  userId: string,
  collectionName: string,
  data: Omit<T, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const docRef = await addDoc(userCollection(userId, collectionName), {
    ...data,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function update<T extends DocumentData>(
  userId: string,
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  // Filter out undefined values to avoid Firestore "Unsupported field value: undefined" errors
  const sanitizedData = Object.keys(data).reduce((acc, key) => {
    const val = (data as any)[key];
    if (val !== undefined) {
      acc[key] = val;
    }
    return acc;
  }, {} as any);

  await updateDoc(userDoc(userId, collectionName, docId), {
    ...sanitizedData,
    updatedAt: Timestamp.now(),
  });
}

export async function remove(
  userId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  await deleteDoc(userDoc(userId, collectionName, docId));
}

// ════════════════════════════════════════════════
// SPECIFIC REPOSITORIES
// ════════════════════════════════════════════════

// Finance sub-collections live under users/{uid}/finance/{subCollection}
function financeCollection(userId: string, subCollection: string) {
  return collection(db, "users", userId, "finance", "data", subCollection);
}

function financeDoc(userId: string, subCollection: string, docId: string) {
  return doc(db, "users", userId, "finance", "data", subCollection, docId);
}

export async function getAllFinance<T>(userId: string, subCollection: string): Promise<T[]> {
  const q = query(
    financeCollection(userId, subCollection),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function getFinanceFiltered<T>(
  userId: string,
  subCollection: string,
  field: string,
  value: string | number | boolean
): Promise<T[]> {
  const q = query(
    financeCollection(userId, subCollection),
    where(field, "==", value),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

export async function createFinance<T extends DocumentData>(
  userId: string,
  subCollection: string,
  data: Omit<T, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const docRef = await addDoc(financeCollection(userId, subCollection), {
    ...data,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateFinance<T extends DocumentData>(
  userId: string,
  subCollection: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  await updateDoc(financeDoc(userId, subCollection, docId), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function removeFinance(
  userId: string,
  subCollection: string,
  docId: string
): Promise<void> {
  await deleteDoc(financeDoc(userId, subCollection, docId));
}
