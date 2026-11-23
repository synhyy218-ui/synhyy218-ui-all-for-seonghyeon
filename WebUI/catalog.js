import { auth, db } from './firebase.js';
import {
  addDoc, collection, getDocs, query, serverTimestamp, where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function submitCaption({ text, language, category }) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('SIGN_IN_REQUIRED');
  await addDoc(collection(db, 'caption_submissions'), {
    uid, text, language, category, status: 'pending', createdAt: serverTimestamp(),
  });
}

async function read(collectionName, status = 'published') {
  if (!db) throw new Error('Firebase chưa được cấu hình.');
  const result = await getDocs(query(collection(db, collectionName), where('status', '==', status)));
  return result.docs.map(record => ({ ...record.data(), id: record.id }));
}

export async function loadStation() {
  const [captions, announcements] = await Promise.all([
    read('captions', 'approved'), read('announcements'),
  ]);
  return {
    captions: captions.filter(item => typeof item.text === 'string').map(item => ({
      id: Number.isInteger(item.sourceId) ? item.sourceId : item.id,
      t: item.text, l: item.language, c: item.category,
    })),
    announcements: announcements.sort((a, b) => a.order - b.order).map(item => item.text),
  };
}

export async function loadComments() {
  const [platforms, templates] = await Promise.all([read('comment_platforms'), read('comment_templates')]);
  const platformEntries = ['ig', 'x', 'ytb'].flatMap(id => {
    const data = platforms.find(platform => platform.id === id);
    if (!data) return [];
    let link = '';
    try {
      const url = new URL(data.url);
      if (url.protocol === 'https:') link = url.href;
    } catch {
      // A platform can have no link yet.
    }
    return [[id, { n: data.title, d: data.description ?? '', u: link, b: data.linkLabel || 'Mở bài đăng ↗' }]];
  });
  return {
    platforms: Object.fromEntries(platformEntries),
    comments: Object.fromEntries(platformEntries.map(([id]) => [id, templates
      .filter(template => template.platform === id && typeof template.text === 'string')
      .sort((a, b) => a.order - b.order)
      .map(template => template.text)])),
  };
}

export async function loadMissions() {
  return (await read('missions')).filter(mission =>
    ['copy', 'ko', 'fav'].includes(mission.action)
    && ['daily', 'weekly'].includes(mission.period)
    && Number.isInteger(mission.target) && mission.target > 0
    && Number.isInteger(mission.xpReward) && mission.xpReward >= 0
  ).map(mission => ({
    id: mission.id, n: mission.title, goal: mission.target, xp: mission.xpReward,
    k: mission.action === 'copy' && mission.period === 'daily' ? 'caption' : mission.action,
    period: mission.period,
  }));
}
