import { db } from './auth.js';
import {
  collection, doc, getDocs, query, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const byId = id => document.getElementById(id);
const form = byId('item-form');
const fields = byId('item-fields');
const select = byId('item-select');
const eventSelect = byId('item-event');
const platformSelect = byId('item-platform');
const search = byId('item-search');
const feedback = byId('item-result');
const types = {
  captions: { title: 'Caption thường', collection: 'captions', publicStatus: 'approved' },
  comments: { title: 'Mẫu bình luận', collection: 'comment_templates', publicStatus: 'published' },
  'event-captions': { title: 'Caption sự kiện', publicStatus: 'approved' },
};
let active;
let items = new Map();
let generation = 0;

function visibility(item) {
  if (!item || item.status === 'draft') return 'Bản nháp';
  if (item.status === 'archived') return 'Đã ẩn';
  return 'Đang hiển thị';
}

function itemCollection() {
  const type = types[active];
  if (type.collection) return collection(db, type.collection);
  return eventSelect.value ? collection(db, 'events', eventSelect.value, 'captions') : null;
}

function fillForm() {
  form.reset();
  const item = items.get(select.value);
  const values = {
    text: item?.text ?? '', language: item?.language || 'en', category: item?.category || 'Ủng hộ',
    platform: item?.platform || platformSelect.value,
  };
  for (const [key, value] of Object.entries(values)) form.elements.namedItem(key).value = value;
  byId('item-visibility').textContent = visibility(item);
  byId('archive-item').hidden = !item || item.status === 'archived';
}

function renderOptions(id = select.value) {
  const keyword = search.value.trim().toLocaleLowerCase('vi');
  select.replaceChildren(new Option('Tạo nội dung mới', ''));
  for (const [key, item] of items) {
    if (key !== id && !item.text.toLocaleLowerCase('vi').includes(keyword)) continue;
    const label = item.text.replace(/\s+/g, ' ').slice(0, 75);
    select.add(new Option(`${visibility(item)} · ${label}`, key));
  }
  select.value = items.has(id) ? id : '';
}

function setBusy(busy) {
  fields.disabled = busy || !active || !itemCollection();
  select.disabled = busy;
  eventSelect.disabled = busy;
  platformSelect.disabled = busy;
  search.disabled = busy;
}

async function refresh(loadEvents = false, selectedId = '') {
  const request = ++generation;
  setBusy(true);
  feedback.textContent = 'Đang tải…';
  try {
    if (loadEvents) {
      const result = await getDocs(collection(db, 'events'));
      if (request !== generation) return;
      const selected = eventSelect.value;
      eventSelect.replaceChildren();
      for (const event of result.docs) {
        eventSelect.add(new Option(event.data().title || event.id, event.id));
      }
      if ([...eventSelect.options].some(option => option.value === selected)) eventSelect.value = selected;
    }
    const ref = itemCollection();
    if (ref) {
      const source = active === 'comments' ? query(ref, where('platform', '==', platformSelect.value)) : ref;
      const result = await getDocs(source);
      if (request !== generation) return;
      items = new Map(result.docs.map(record => [record.id, record.data()])
        .filter(([, item]) => typeof item.text === 'string')
        .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0)));
    } else {
      items = new Map();
    }
    search.value = '';
    renderOptions(selectedId);
    fillForm();
    feedback.textContent = ref ? '' : 'Tạo một sự kiện trước khi thêm caption.';
    setBusy(false);
  } catch (error) {
    if (request !== generation) return;
    feedback.textContent = 'Không tải được nội dung: ' + (error.code || error.message);
    eventSelect.disabled = false;
    platformSelect.disabled = false;
  }
}

export function showItems(mode) {
  active = types[mode] ? mode : null;
  if (!active) {
    generation++;
    items.clear();
    renderOptions('');
    fillForm();
    setBusy(true);
    return;
  }
  byId('items-heading').textContent = types[active].title;
  byId('item-event-field').hidden = active !== 'event-captions';
  byId('item-platform-field').hidden = active !== 'comments';
  byId('item-language-field').hidden = active === 'comments';
  byId('item-target-platform-field').hidden = active !== 'comments';
  byId('item-category-field').hidden = active !== 'captions';
  void refresh(active === 'event-captions');
}

eventSelect.addEventListener('change', () => void refresh());
platformSelect.addEventListener('change', () => void refresh());
select.addEventListener('change', () => {
  feedback.textContent = '';
  fillForm();
});
search.addEventListener('input', () => renderOptions());

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!active || fields.disabled) return;
  const request = generation;
  const action = event.submitter?.value;
  const existing = items.get(select.value);
  const archive = action === 'archive';
  if (archive && !existing) return;
  const input = new FormData(form);
  const text = input.get('text').trim();
  if (!archive && !text) {
    feedback.textContent = 'Nhập nội dung trước khi lưu.';
    return;
  }
  const status = action === 'publish' ? types[active].publicStatus : existing?.status || 'draft';
  let values = { status: 'archived' };
  if (!archive) {
    values = active === 'comments'
      ? { text, status, platform: input.get('platform'), order: existing?.order ?? Date.now() }
      : { text, status, language: input.get('language') };
    if (active === 'captions') values.category = input.get('category');
    if (active === 'event-captions') values.order = existing?.order ?? Date.now();
  }
  const collectionRef = itemCollection();
  const ref = existing ? doc(collectionRef, select.value) : doc(collectionRef);
  setBusy(true);
  feedback.textContent = 'Đang lưu…';
  try {
    const batch = writeBatch(db);
    if (existing) batch.update(ref, values);
    else batch.set(ref, values);
    await batch.commit();
    if (request !== generation) return;
    if (active === 'comments' && values.platform && values.platform !== platformSelect.value) {
      platformSelect.value = values.platform;
      await refresh(false, ref.id);
      if (select.value === ref.id) feedback.textContent = 'Đã lưu trong nền tảng mới.';
      return;
    }
    items.set(ref.id, { ...existing, ...values });
    renderOptions(ref.id);
    fillForm();
    feedback.textContent = archive ? 'Đã ẩn trên website. Có thể hiển thị lại bất cứ lúc nào.'
      : 'Đã lưu · ' + visibility(items.get(ref.id));
  } catch (error) {
    if (request === generation) feedback.textContent = 'Không lưu được: ' + (error.code || error.message);
  } finally {
    if (request === generation) setBusy(false);
  }
});
