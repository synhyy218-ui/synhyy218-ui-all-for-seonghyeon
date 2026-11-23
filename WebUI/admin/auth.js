import { firebaseConfig, isFirebaseConfigured } from '../firebase.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  browserSessionPersistence, initializeAuth, onIdTokenChanged, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = isFirebaseConfigured ? initializeApp(firebaseConfig, 'admin') : null;
const auth = app ? initializeAuth(app, { persistence: browserSessionPersistence }) : null;
export const db = app ? getFirestore(app) : null;

async function hasAdminAccess(user) {
  const token = await user.getIdTokenResult();
  return token.signInProvider === 'password' && token.claims.eventAdmin === true;
}

export function observeAdmin(callback) {
  let generation = 0;
  return onIdTokenChanged(auth, async user => {
    const attempt = ++generation;
    let admin = null;
    try {
      if (user && await hasAdminAccess(user)) admin = user;
    } catch {
      // A failed token check grants no access.
    }
    if (attempt === generation) callback(admin);
  });
}

export async function signInAdmin(username, password) {
  if (username.trim().toLowerCase() !== 'synhy') throw new Error('Invalid username');
  const { user } = await signInWithEmailAndPassword(auth, 'synhy@admin.silcosudo.github.io', password);
  try {
    if (!await hasAdminAccess(user)) throw new Error('Admin access required');
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export const signOutAdmin = () => signOut(auth);
