/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, User } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let appInstance;
let isConfigured = false;
let dbInstance: any = null;
let authInstance: any = null;

// Determine if Firebase is physically configured with clean keys
if (
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes("MOCK_KEY_PLACEHOLDER") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes("mock-project")
) {
  try {
    appInstance = initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || undefined);
    authInstance = getAuth(appInstance);
    isConfigured = true;
    console.log("[Firebase] Inicializované v režime Cloud.");
  } catch (err) {
    console.warn("[Firebase] Inicializácia cloudového pripojenia zlyhala. Spúšťame Local-Bypass.", err);
  }
} else {
  console.log("[Firebase] CONFIG kľúče sú neúplné. Spúšťame automatický Guest/LocalStorage-Bypass.");
}

export const isFirebaseConfigured = isConfigured;
export const db = dbInstance;
export const auth = authInstance;

// Error handler utility
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || "GUEST_LOCAL",
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || false,
      isAnonymous: currentUser?.isAnonymous || true,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Firebase connection dynamically on bootstrap (validated from Skill guidelines)
export async function testConnection() {
  if (!isFirebaseConfigured || !db) return false;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error: any) {
    if (error?.message?.includes("the client is offline")) {
      console.warn("Firebase client hlási offline režim. Prechádzame na lokálnu vyrovnávaciu pamäť.");
    }
    return false;
  }
}

// Trigger Google Login
export async function loginWithGoogle() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error("Firebase nie je nakonfigurovaný v konzole. Prihláste sa cez Hosťovský režim s obídením kľúčov.");
  }
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

// Trigger Anonymous Login
export async function loginAnonymously() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error("Firebase nie je nakonfigurovaný. Spúšťa sa automatický lokálny bypass...");
  }
  const res = await signInAnonymously(auth);
  return res.user;
}
