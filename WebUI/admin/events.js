import { db } from './auth.js';
import { collection, doc, getDocs, Timestamp, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const select = document.getElementById('event-select');
const form = document.getElementById('event-form');
const fields = document.getElementById('event-fields');
const feedback = document.getElementById('event-result');
const controls = form.elements;
let session;
let events = new Map();

const lines = value => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const toVietnamTime = value => value?.toMillis
  ? new Date(value.toMillis() + 7 * 3600_000).toISOString().slice(0, 19)
  : '';

function fillForm(event) {
  form.reset();
  document.getElementById('archive-event').hidden = !event || event.status === 'archived';
  if (!event) return;
  for (const key of ['title', 'requiredCopies', 'xpReward', 'badge', 'status', 'tagline']) {
    if (event[key] != null) controls.namedItem(key).value = event[key];
  }
  controls.namedItem('start').value = toVietnamTime(event.startsAt);
  controls.namedItem('end').value = toVietnamTime(event.endsAt);
  controls.namedItem('hashtags').value = Array.isArray(event.hashtags) ? event.hashtags.join(' ') : event.tag ?? '';
  for (const key of ['description', 'keywords', 'notes']) {
    if (Array.isArray(event[key])) controls.namedItem(key).value = event[key].join('\n');
  }
}

function renderOptions(id = select.value) {
  select.replaceChildren(new Option('Tạo sự kiện mới', ''));
  for (const [eventId, event] of events) {
    const status = event.status === 'published' ? 'Đã xuất bản' : event.status === 'archived' ? 'Đã ẩn' : 'Bản nháp';
    select.add(new Option(`${event.title || eventId} · ${status}`, eventId));
  }
  select.value = events.has(id) ? id : '';
}

export async function refreshEvents() {
  const active = session;
  if (!active) return;
  try {
    const result = await getDocs(collection(db, 'events'));
    if (active !== session) return;
    events = new Map(result.docs.map(record => [record.id, record.data()]));
    renderOptions();
  } catch (error) {
    if (active === session) feedback.textContent = 'Không tải được danh sách sự kiện: ' + (error.code || error.message);
  }
}

export function setEventAdmin(user) {
  if (user?.uid === session?.uid) return;
  session = user ? { uid: user.uid } : null;
  fields.disabled = !session;
  select.disabled = false;
  feedback.textContent = '';
  events = new Map();
  renderOptions('');
  fillForm();
  if (session) void refreshEvents();
}

select.addEventListener('change', () => {
  feedback.textContent = '';
  fillForm(events.get(select.value));
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const active = session;
  if (!active || fields.disabled) return;
  const id = select.value;
  if (event.submitter?.value === 'archive') {
    const current = events.get(id);
    if (!current) return;
    fields.disabled = true;
    select.disabled = true;
    try {
      await updateDoc(doc(db, 'events', id), { status: 'archived' });
      if (session !== active) return;
      const archived = { ...current, status: 'archived' };
      events.set(id, archived);
      renderOptions(id);
      fillForm(archived);
      feedback.textContent = 'Đã ẩn sự kiện. Kho caption và tiến độ vẫn được lưu.';
    } catch (error) {
      if (session === active) feedback.textContent = 'Không ẩn được sự kiện: ' + (error.code || error.message);
    } finally {
      if (session === active) {
        fields.disabled = false;
        select.disabled = false;
      }
    }
    return;
  }
  const data = new FormData(form);
  const text = key => data.get(key).trim();
  const title = text('title');
  const start = Date.parse(text('start') + '+07:00');
  const end = Date.parse(text('end') + '+07:00');
  const captions = lines(text('captions'));
  if (!title || !(start < end)) {
    feedback.textContent = 'Nhập tên sự kiện và thời gian kết thúc sau thời gian bắt đầu.';
    return;
  }
  if (captions.length > 300 || captions.some(caption => caption.length > 2000)) {
    feedback.textContent = 'Mỗi lần có thể thêm tối đa 300 caption, mỗi caption tối đa 2.000 ký tự.';
    return;
  }
  const values = {
    title,
    startsAt: Timestamp.fromMillis(start), endsAt: Timestamp.fromMillis(end),
    requiredCopies: Number(data.get('requiredCopies')), xpReward: Number(data.get('xpReward')),
    badge: text('badge'), status: event.submitter?.value === 'publish' ? 'published' : text('status'),
    tagline: text('tagline'),
    hashtags: text('hashtags').split(/\s+/).filter(Boolean),
    description: lines(text('description')), keywords: lines(text('keywords')), notes: lines(text('notes')),
  };
  const reference = id ? doc(db, 'events', id) : doc(collection(db, 'events'));
  fields.disabled = true;
  select.disabled = true;
  feedback.textContent = 'Đang lưu sự kiện…';
  try {
    const batch = writeBatch(db);
    if (id) batch.update(reference, values);
    else batch.set(reference, values);
    const order = Date.now();
    for (const [index, caption] of captions.entries()) {
      batch.set(doc(collection(reference, 'captions')), {
        text: caption, language: text('language'), order: order + index, status: 'approved',
      });
    }
    await batch.commit();
    if (active !== session) return;
    events.set(reference.id, { ...events.get(reference.id), ...values });
    renderOptions(reference.id);
    fillForm(values);
    const result = values.status === 'published'
      ? 'Đã xuất bản. Sự kiện hiển thị trên trang thành viên.'
      : values.status === 'archived' ? 'Đã lưu. Sự kiện đang ẩn.'
      : 'Đã lưu bản nháp. Bấm Lưu và xuất bản để hiện trên trang thành viên.';
    feedback.textContent = captions.length ? `${result} Đã thêm ${captions.length} caption.` : result;
  } catch (error) {
    if (active === session) feedback.textContent = 'Không lưu được sự kiện: ' + (error.code || error.message);
  } finally {
    if (active === session) {
      fields.disabled = false;
      select.disabled = false;
    }
  }
});
