import { db, observeAdmin, signInAdmin, signOutAdmin } from "./auth.js";
import { doc, getDoc, Timestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { refreshEvents, setEventAdmin } from "./events.js";
import { showItems } from "./items.js";

const $ = id => document.getElementById(id);
const ALLOWED = new Set([
  "captions", "events", "comment_platforms",
  "comment_templates", "missions", "announcements"
]);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DOCS = 1000;
const PROJECT_ID = "all-for-eom-seonghyeon-651f9";
let currentUser = null;
let parsed = null;
let busy = false;
let signingIn = false;
const log = message => { $("result").textContent = message; };
const message = text => { $("preview-message").textContent = text; };

const tabs = [...document.querySelectorAll("[data-view]")];
function showView(view) {
  const itemView = ["captions", "comments", "event-captions"].includes(view);
  $("manage-events").hidden = view !== "events";
  $("manage-import").hidden = view !== "import";
  $("manage-items").hidden = !itemView;
  for (const tab of tabs) tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
  showItems(itemView ? view : null);
}
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    if (currentUser && tab.getAttribute("aria-pressed") !== "true") showView(tab.dataset.view);
  });
}

function validateSeed(seed) {
  if (!seed || typeof seed !== "object" || Array.isArray(seed) || seed.schemaVersion !== 1)
    throw Error("Sai định dạng: cần schemaVersion = 1.");
  if (!seed.collections || typeof seed.collections !== "object" || Array.isArray(seed.collections))
    throw Error("Không tìm thấy collections.");
  const entries = [];
  const counts = {};
  for (const [path, records] of Object.entries(seed.collections)) {
    const eventCaptions = /^events\/[A-Za-z0-9_-]{1,100}\/captions$/.test(path);
    if (!ALLOWED.has(path) && !eventCaptions) throw Error("Collection không được hỗ trợ: " + path);
    if (!Array.isArray(records)) throw Error("Collection phải là mảng: " + path);
    counts[path] = records.length;
    for (const record of records) {
      if (!record || typeof record !== "object" || Array.isArray(record))
        throw Error("Document không hợp lệ trong " + path);
      const { id, ...data } = record;
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id))
        throw Error("Document ID không hợp lệ trong " + path);
      if (!("text" in data) && !("title" in data))
        throw Error("Document thiếu nội dung trong " + path + "/" + id);
      if (path === "events") {
        const { startsAt, endsAt, startDate, endDate } = data;
        const start = Date.parse(startsAt ?? (startDate + "T00:00:00+07:00"));
        const end = endsAt === undefined
          ? Date.parse(endDate + "T00:00:00+07:00") + 86400000
          : Date.parse(endsAt);
        if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 160
          || !(start < end) || !Number.isInteger(data.requiredCopies) || data.requiredCopies < 1 || data.requiredCopies > 1000
          || !Number.isInteger(data.xpReward) || data.xpReward < 0 || data.xpReward > 100000)
          throw Error("Tên, thời gian, số caption mục tiêu hoặc XP không hợp lệ: " + id);
        data.startsAt = Timestamp.fromMillis(start);
        data.endsAt = Timestamp.fromMillis(end);
        data.status ??= "draft";
        if (!["draft", "published", "archived"].includes(data.status)) throw Error("Trạng thái sự kiện không hợp lệ: " + id);
      }
      if (eventCaptions || path === "captions" || path === "comment_templates") {
        const comment = path === "comment_templates";
        data.status ??= "draft";
        if (eventCaptions) data.language ??= "en";
        if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 2000
          || !["draft", "archived", comment ? "published" : "approved"].includes(data.status)
          || (!comment && !["en", "ko"].includes(data.language))
          || (path === "captions" && !["Ủng hộ", "Cảm ơn", "Chúc mừng"].includes(data.category))
          || (comment && !["ig", "x", "ytb"].includes(data.platform))
          || ((comment || eventCaptions) && (!Number.isInteger(data.order) || data.order < 0))) {
          throw Error("Nội dung hoặc thông tin phân loại không hợp lệ: " + id);
        }
      }
      const segments = (path + "/" + id).split("/");
      if (segments.length % 2 !== 0) throw Error("Đường dẫn document không hợp lệ.");
      entries.push({ path: path + "/" + id, data });
    }
  }
  if (!entries.length || entries.length > MAX_DOCS) throw Error("Số document không hợp lệ.");
  if (new Set(entries.map(x => x.path)).size !== entries.length)
    throw Error("Có document ID trùng.");
  return { entries, counts };
}

function updateButton() {
  $("import").disabled = busy || !currentUser || !parsed ||
    $("confirm-project").value.trim() !== PROJECT_ID || !$("ack").checked;
}

$("admin-login").onsubmit = async event => {
  event.preventDefault();
  if (!db || currentUser || signingIn) return;
  signingIn = true;
  $("login").disabled = true;
  const passwordInput = $("admin-password");
  const password = passwordInput.value;
  passwordInput.value = "";
  try {
    await signInAdmin($("admin-username").value, password);
  } catch {
    $("auth-state").textContent = "Không thể đăng nhập. Hãy kiểm tra tên tài khoản và mật khẩu.";
  } finally {
    signingIn = false;
    $("login").disabled = !!currentUser;
  }
};
$("logout").onclick = async () => {
  try { await signOutAdmin(); } catch(e) { log("Đăng xuất thất bại: " + e.message); }
};
$("confirm-project").addEventListener("input", updateButton);
$("ack").addEventListener("change", updateButton);

if (!db) {
  $("auth-state").textContent = "Firebase chưa cấu hình.";
} else {
  observeAdmin(user => {
    const changed = currentUser?.uid !== user?.uid;
    currentUser = user;
    setEventAdmin(user);
    $("workspace").hidden = !user;
    if (changed) showView("events");
    $("auth-state").textContent = user
      ? "Đã đăng nhập quản trị: synhy"
      : "Chưa đăng nhập.";
    $("admin-login").hidden = !!user;
    $("login").disabled = !!user || signingIn;
    $("logout").disabled = !user;
    updateButton();
  });
}

$("file").addEventListener("change", async event => {
  parsed = null;
  $("preview").replaceChildren();
  try {
    const file = event.target.files?.[0];
    if (!file) { message("Chưa chọn file."); return; }
    if (file.size > MAX_BYTES) throw Error("File vượt giới hạn 2 MB.");
    parsed = validateSeed(JSON.parse(await file.text()));
    message("Đã kiểm tra " + parsed.entries.length + " document. Đây chỉ là bản xem trước.");
    const table = document.createElement("table");
    const header = document.createElement("tr");
    for (const title of ["Đường dẫn collection", "Document"]) {
      const th = document.createElement("th"); th.textContent = title; header.append(th);
    }
    table.append(header);
    for (const [path, count] of Object.entries(parsed.counts)) {
      const tr = document.createElement("tr");
      for (const text of [path, String(count)]) {
        const td = document.createElement("td"); td.textContent = text; tr.append(td);
      }
      table.append(tr);
    }
    $("preview").append(table);
  } catch(e) {
    parsed = null;
    message("Không đọc được JSON: " + e.message);
  } finally { updateButton(); }
});

$("import").onclick = async () => {
  updateButton();
  if ($("import").disabled || !currentUser || !db) return;
  const { entries } = parsed;
  busy = true; updateButton();
  let created = 0, skipped = 0, scanned = 0;
  try {
    log("Đang kiểm tra document đã tồn tại…");
    // Explicitly check existing documents before writing. Existing documents are never overwritten.
    const missing = [];
    for (const item of entries) {
      const snap = await getDoc(doc(db, item.path));
      scanned++;
      if (snap.exists()) skipped++; else missing.push(item);
      if (scanned % 30 === 0) log("Đã kiểm tra " + scanned + "/" + entries.length);
    }
    // Every batch is below Firestore's 500-operation limit.
    for (let offset = 0; offset < missing.length; offset += 150) {
      const slice = missing.slice(offset, offset + 150);
      const batch = writeBatch(db);
      for (const item of slice) batch.set(doc(db, item.path), item.data);
      await batch.commit();
      created += slice.length;
      log("Đã tạo " + created + "/" + missing.length + "; bỏ qua " + skipped + " document có sẵn.");
    }
    log("Hoàn tất: đã tạo " + created + ", bỏ qua " + skipped + " document đã tồn tại.");
  } catch(e) {
    console.error("Firestore import failed", e);
    log("Import dừng. Đã tạo " + created + " document. Lỗi: " +
      (e.code || e.message) + ". Nếu là permission-denied, kiểm tra Admin UID và Security Rules.");
  } finally { busy = false; updateButton(); }
  if (created) void refreshEvents();
};
