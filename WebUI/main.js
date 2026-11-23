const byId = id => document.getElementById(id);
const eventView = byId('events');
let user = null;
let disposeEvents;
let eventGeneration = 0;

async function showEvents() {
  const generation = ++eventGeneration;
  disposeEvents?.();
  disposeEvents = undefined;
  if (eventView.hidden) {
    eventView.replaceChildren();
    return;
  }
  eventView.textContent = 'Đang tải sự kiện…';
  try {
    const { mountEvents } = await import('./events.js');
    if (generation === eventGeneration) disposeEvents = mountEvents(eventView, user);
  } catch {
    if (generation === eventGeneration) eventView.textContent = 'Không tải được sự kiện. Hãy mở lại mục Sự kiện để thử lại.';
  }
}

window.addEventListener('station-tab', ({ detail }) => {
  const showingEvents = detail === 'event';
  if (eventView.hidden === !showingEvents) return;
  byId('v').hidden = showingEvents;
  eventView.hidden = !showingEvents;
  void showEvents();
});

const station = import('./station.js').catch(error => {
  console.error(error);
  byId('app-error').hidden = false;
});

const authButton = byId('auth');
import('./firebase.js').then(account => {
  account.observeAuth(value => {
    if (value?.uid !== user?.uid) {
      void station.then(module => {
        if (user?.uid === value?.uid) module?.setProfileUser(value?.uid ?? null);
      });
    }
    if (value?.uid !== user?.uid && !eventView.hidden) {
      user = value;
      void showEvents();
    } else {
      user = value;
    }
    byId('account').textContent = user?.displayName || user?.email || '';
    byId('account').hidden = !user;
    authButton.textContent = user ? 'Đăng xuất' : 'Đăng nhập Google';
  });
  authButton.disabled = !account.isFirebaseConfigured;
  authButton.addEventListener('click', async () => {
    authButton.disabled = true;
    byId('auth-error').hidden = true;
    try {
      if (user) await account.signOutUser();
      else await account.signInWithGoogle();
    } catch {
      byId('auth-error').hidden = false;
    } finally {
      authButton.disabled = false;
    }
  });
}).catch(() => { byId('auth-error').hidden = false; });

const playlist = byId('playlist');
const playlistButton = byId('playlist-toggle');
playlistButton.addEventListener('click', () => {
  if (!playlist.querySelector('iframe')) {
    const frame = document.createElement('iframe');
    frame.title = 'SEONGHYEON playlist';
    frame.allow = 'autoplay; encrypted-media';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = 'https://www.youtube.com/embed/videoseries?list=PLq1T7LUE88u4IxwwYNDPMZq3U72u1oH5X&autoplay=1&loop=1';
    playlist.insertBefore(frame, playlist.querySelector('a'));
  }
  playlist.hidden = !playlist.hidden;
  playlistButton.setAttribute('aria-expanded', String(!playlist.hidden));
});
