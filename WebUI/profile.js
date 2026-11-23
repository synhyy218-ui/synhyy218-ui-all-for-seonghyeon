import { db } from './firebase.js';
import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const profileRef = uid => doc(db, 'user_profiles', uid);

export async function readProfile(uid) {
  const snapshot = await getDocFromServer(profileRef(uid));
  return snapshot.data() ?? { revision: 0, data: null };
}

export async function writeProfile(uid, revision, data) {
  const ref = profileRef(uid);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.revision ?? 0;
    if (current !== revision) return null;
    transaction.set(ref, { revision: current + 1, data, updatedAt: serverTimestamp() });
    return current + 1;
  });
}
