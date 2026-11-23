import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Public Firebase Web App configuration (not service-account credentials).
// Google Analytics is intentionally not initialized.
export const firebaseConfig = {
  apiKey: "AIzaSyCg9prbDOP7DLGI8zQDNgVd-yZQw-lxQ6c",
  authDomain: "all-for-eom-seonghyeon-651f9.firebaseapp.com",
  projectId: "all-for-eom-seonghyeon-651f9",
  storageBucket: "all-for-eom-seonghyeon-651f9.firebasestorage.app",
  messagingSenderId: "314897112238",
  appId: "1:314897112238:web:c962e1a52b0512ba4d613f",
  measurementId: "G-DFQTE0ZTR3"
};

export const isFirebaseConfigured = ["apiKey", "authDomain", "projectId", "appId"]
  .every(key => typeof firebaseConfig[key] === "string" && firebaseConfig[key].trim() !== "");

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

const googleProvider = new GoogleAuthProvider();

export function observeAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase chưa được cấu hình.");
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  if (!auth) throw new Error("Firebase chưa được cấu hình.");
  return signOut(auth);
}
