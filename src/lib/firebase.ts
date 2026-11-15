import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/**
 * Public Firebase web config for the existing FinNova project.
 * These keys are public by design (they identify the project, they do not grant access).
 * Access to data is enforced by Firestore security rules plus the signed-in user's uid.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAawZ57Tel3jdCi3qNpkSegKYGzDmPCamE",
  authDomain: "finnova-fd6d5.firebaseapp.com",
  projectId: "finnova-fd6d5",
  storageBucket: "finnova-fd6d5.firebasestorage.app",
  messagingSenderId: "958408760448",
  appId: "1:958408760448:web:bd27fa74a4775f8f4cda65",
  measurementId: "G-T0Z5T8VY4D",
} as const;

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let app = null as ReturnType<typeof initializeApp> | null;
let auth = null as Auth | null;
let db = null as Firestore | null;

if (firebaseEnabled) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Keep users signed in across refreshes/tabs unless they explicitly sign out.
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("[FinNova] Could not persist auth session:", err);
  });
  try {
    // Offline queue + multi-tab cache: edits survive flaky connections.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }
}

export { app, auth, db };

/** Map Firebase / network errors to actionable, human language. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid. Please check it and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try logging in instead.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/network-request-failed":
      return "Network problem — check your internet connection and try again.";
    case "auth/requires-recent-login":
      return "For security, please sign in again before making this change.";
    case "permission-denied":
      return "Firebase refused the request. Make sure you are signed in and the latest security rules are deployed (firebase deploy --only firestore:rules).";
    case "unauthenticated":
      return "Your session expired. Please sign in again.";
    case "not-found":
    case "failed-precondition":
      return "Cloud Firestore is not ready for this project yet. Create the Firestore database, then deploy the security rules.";
    case "resource-exhausted":
      return "Firebase quota exceeded for this project. Please try again later.";
    case "unavailable":
    case "network-request-failed":
      return "You appear to be offline — your change could not be saved yet. Check your connection and try again.";
    case "aborted":
      return "The operation was aborted by a conflicting change. Please retry.";
    default:
      return e?.message || "Something went wrong. Please try again.";
  }
}
