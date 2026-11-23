import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const pageSize = 20;
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});

async function loadCaptions(eventId, cursor) {
  const constraints = [where('status', '==', 'approved'), orderBy('order'), limit(pageSize)];
  if (cursor) constraints.push(startAfter(cursor));
  const result = await getDocs(query(collection(db, 'events', eventId, 'captions'), ...constraints));
  return {
    items: result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id })),
    cursor: result.docs.length === pageSize ? result.docs.at(-1) : null,
  };
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function mountCard(container, event, user, signal) {
  const card = element('article', null, 'c');
  container.append(card);
  const participationRef = user ? doc(db, 'events', event.id, 'participants', user.uid) : null;
  let participation = null;
  let loadingProgress = Boolean(user);
  let page;
  let index = 0;
  let busy = false;
  let message = '';

  async function perform(action) {
    if (busy || signal.aborted) return;
    busy = true;
    message = '';
    render();
    try {
      await action();
    } catch (error) {
      console.error(error);
      message = 'Thao tác chưa hoàn tất. Hãy thử lại.';
    } finally {
      busy = false;
      render();
    }
  }

  const join = () => perform(async () => {
    participation = await runTransaction(db, async transaction => {
      const existing = await transaction.get(participationRef);
      if (existing.exists()) return existing.data();
      const data = { copiedCaptionIds: [], joinedAt: serverTimestamp() };
      transaction.set(participationRef, data);
      return data;
    });
  });

  const showPage = cursor => perform(async () => {
    page = await loadCaptions(event.id, cursor);
    index = 0;
  });

  const copy = caption => perform(async () => {
    const text = [caption.text, event.tagline, event.hashtags?.join(' ') || event.tag]
      .filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(text);
    if (signal.aborted) return;
    try {
      participation.copiedCaptionIds = await runTransaction(db, async transaction => {
        const existing = await transaction.get(participationRef);
        const copied = existing.data().copiedCaptionIds;
        if (copied.includes(caption.id) || copied.length >= event.requiredCopies) return copied;
        const updated = [...copied, caption.id];
        transaction.update(participationRef, { copiedCaptionIds: updated });
        return updated;
      });
      message = 'Đã sao chép.';
      if (index + 1 < page.items.length) index++;
    } catch (error) {
      console.error(error);
      message = 'Đã sao chép nhưng chưa lưu được tiến độ. Hãy thử lại.';
    }
  });

  function button(label, action, secondary = false, unavailable = false) {
    const node = element('button', label, secondary ? 'b g' : 'b');
    node.type = 'button';
    node.disabled = busy || unavailable;
    node.addEventListener('click', action);
    return node;
  }

  function render() {
    if (signal.aborted) return;
    const now = Date.now();
    const active = event.startsAt.toMillis() <= now && now < event.endsAt.toMillis();
    const status = active ? 'Đang diễn ra' : now < event.startsAt.toMillis() ? 'Sắp diễn ra' : 'Đã kết thúc';
    const heading = element('div', null, 'row');
    heading.append(element('h2', event.title), element('span', status, 'tag'));
    const details = element('details');
    details.open = card.querySelector('details')?.open ?? false;
    details.append(element('summary', 'Xem chi tiết'));
    for (const text of event.description ?? []) details.append(element('p', text));
    if (event.keywords?.length) details.append(element('p', 'Từ khóa ' + event.keywords.join(' · ')));
    for (const text of event.notes ?? []) details.append(element('p', text));
    card.replaceChildren(
      heading,
      element('p', dateFormat.format(event.startsAt.toDate()) + ' → '
        + dateFormat.format(event.endsAt.toDate()) + ' (giờ Việt Nam)'),
      element('p', [event.tagline, event.hashtags?.join(' ') || event.tag].filter(Boolean).join(' ')),
      details,
      element('p', 'Mốc thưởng theo cấu hình ' + event.xpReward + ' XP ' + (event.badge ?? '')),
    );

    if (participation) {
      const copies = participation.copiedCaptionIds.length;
      const completed = copies >= event.requiredCopies ? ' · Đã hoàn thành' : '';
      card.append(element('p', 'Tiến độ ' + copies + '/' + event.requiredCopies + completed));
    }

    if (active && !user) {
      card.append(element('p', 'Đăng nhập để tham gia và lưu tiến độ.'));
    } else if (active && !participation) {
      card.append(button('Tham gia', join, false, loadingProgress));
    } else if (active && !page) {
      card.append(button('Mở caption', () => showPage()));
    } else if (active) {
      const caption = page.items[index];
      if (caption) {
        const actions = element('div', null, 'row');
        actions.append(button('Copy caption', () => copy(caption)));
        if (index + 1 < page.items.length) {
          actions.append(button('Câu tiếp', () => { index++; render(); }, true));
        } else if (page.cursor) {
          actions.append(button('Tải thêm', () => showPage(page.cursor), true));
        } else {
          actions.append(button('Về câu đầu', () => showPage(), true));
        }
        card.append(element('p', caption.text, 'cap'), actions);
      } else {
        card.append(element('p', 'Không có thêm caption đã duyệt.'), button('Về câu đầu', () => showPage(), true));
      }
    }

    const feedback = element('p', message);
    feedback.setAttribute('role', 'status');
    card.append(feedback);
  }

  render();
  if (participationRef) {
    getDoc(participationRef).then(snapshot => {
      participation = snapshot.data() ?? null;
    }).catch(() => {
      message = 'Không đọc được tiến độ. Hãy mở lại mục Sự kiện để thử lại.';
    }).finally(() => {
      loadingProgress = false;
      render();
    });
  }
  return card;
}

export function mountEvents(container, user) {
  if (!db) {
    container.textContent = 'Firebase chưa được cấu hình.';
    return () => {};
  }

  const cards = new Map();
  function removeCard(id) {
    const entry = cards.get(id);
    if (!entry) return;
    entry.controller.abort();
    entry.card.remove();
    cards.delete(id);
  }

  const events = query(collection(db, 'events'), where('status', '==', 'published'));
  const unsubscribe = onSnapshot(events, snapshot => {
    if (!cards.size) container.replaceChildren();
    for (const change of snapshot.docChanges()) {
      const { id } = change.doc;
      removeCard(id);
      if (change.type === 'removed') continue;
      const event = { ...change.doc.data(), id };
      if (!event.startsAt?.toMillis || !event.endsAt?.toMillis) continue;
      const controller = new AbortController();
      const card = mountCard(container, event, user, controller.signal);
      cards.set(id, { controller, card, startsAt: event.startsAt.toMillis() });
    }
    if (!cards.size) {
      container.textContent = 'Chưa có sự kiện được xuất bản.';
      return;
    }
    let next = container.firstElementChild;
    for (const { card } of [...cards.values()].sort((a, b) => b.startsAt - a.startsAt)) {
      if (card !== next) container.insertBefore(card, next);
      next = card.nextElementSibling;
    }
  }, () => {
    for (const id of cards.keys()) removeCard(id);
    container.textContent = 'Không tải được sự kiện từ Firebase. Hãy mở lại mục Sự kiện để thử lại.';
  });

  return () => {
    unsubscribe();
    for (const id of cards.keys()) removeCard(id);
  };
}
