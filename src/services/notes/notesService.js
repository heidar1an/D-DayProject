/*
 * سرویس یادداشت تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock با
 * persistence در localStorage ( تا یادداشت‌ها بین رفرش‌ها و ورودهای بعدی کاربر بمانند).
 *
 * قراردادهای آینده (اتصال Backend فقط بدنهٔ این توابع را تغییر می‌دهد):
 *   GET    /api/notes?q=&subject=&sort=   ← fetchNotes (فعلاً همه داده می‌آید و فیلتر سمت UI است)
 *   POST   /api/notes                     ← createNote
 *   PATCH  /api/notes/:id                 ← updateNote
 *   DELETE /api/notes/:id                 ← deleteNote
 *   POST   /api/notes/:id/pin             ← setNotePinned
 *   POST   /api/notes/:id/checklist/:itemId/toggle ← toggleChecklistItem
 *
 * اصول:
 *   - هیچ منطق نمایشی در سرویس نیست؛ فقط CRUD + قواعد دامنه (snippet، فیلتر، مرتب‌سازی).
 *   - داده به تفکیک userId ذخیره می‌شود؛ seed فقط بار اول ساخته می‌شود.
 *   - toggleChecklistItem برای روان‌بودن UI آفلاین-فرست است (UI ابتدا local را عوض می‌کند).
 */

import { NOTE_COLORS, SUBJECTS, TAG_COLORS } from './mockData';

/* برای مصرف‌کننده‌ها: متادیتای دامنه از یک منبع (سرویس) خوانده شود */
export { NOTE_COLORS, NOTE_KINDS, SOURCE_TYPES, SUBJECTS, TAG_COLORS } from './mockData';

const STORAGE_KEY = 'tapesh:notes:v2';
/* کلیدهای نسخهٔ قبل: یادداشت‌های نمونهٔ پیش‌فرض در آن‌ها نشسته بود.
   یک‌بار پاک می‌شوند تا کاربر (تازه یا قدیمی) هیچ یادداشت ازپیش‌موجودی نبیند. */
const LEGACY_KEYS = ['tapesh:notes:v1'];
let legacyPurged = false;
const LATENCY_MS = 300;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function respond(build) {
  await delay(LATENCY_MS + Math.random() * 140);
  return build();
}

/* ── لایهٔ ذخیره‌سازی (در نسخهٔ واقعی: Backend) ── */

let simulateFailure = false;
/* برای تست حالت خطا از کنسول: __notesService.__setFailure(true) */
export function __setFailure(next) {
  simulateFailure = next;
}

function purgeLegacyKeys() {
  if (legacyPurged || typeof window === 'undefined') return;
  legacyPurged = true;
  LEGACY_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* حافظه غیرفعال — چیزی برای پاک‌کردن نیست */
    }
  });
}

function readStore() {
  if (typeof window === 'undefined') return {};
  purgeLegacyKeys();
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* حافظه پر یا غیرفعال — عملیات جاری از دست می‌رود ولی اپ می‌شکند */
  }
}

const userKey = (userData) => `u:${userData?.id ?? 'guest'}`;

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* فضای هر کاربر از خالی شروع می‌شود — هیچ یادداشت پیش‌فرضی ساخته نمی‌شود */
function seedUserSpace() {
  return { notes: [] };
}

function getUserSpace(userData) {
  const store = readStore();
  if (!store[userKey(userData)]) {
    store[userKey(userData)] = seedUserSpace(userData);
    writeStore(store);
  }
  return store[userKey(userData)];
}

function mutateUserSpace(userData, mutator) {
  const store = readStore();
  const key = userKey(userData);
  if (!store[key]) store[key] = seedUserSpace(userData);
  mutator(store[key]);
  writeStore(store);
  return store[key];
}

/* ─────────────────────────── قرارداد نمایش ─────────────────────────── */

export const subjectLabel = (id) => SUBJECTS.find((s) => s.id === id)?.label ?? 'عمومی';
export const subjectAccent = (id) => SUBJECTS.find((s) => s.id === id)?.accent ?? '#8a8a8a';
export const noteColor = (note) => NOTE_COLORS.includes(note?.color) ? note.color: 'var(--blue-ink)';

/* نرمال‌سازی متن برای جست‌وجو: فارسی/عربی و نیم‌فاصله به هم برسند */
function normalizeForSearch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ');
}

/* متن خلاصهٔ کارت: از هر حالت یادداشت یک پیش‌نمایش خوانا می‌سازد */
export function buildSnippet(note, maxChars = 140) {
  let raw = '';
  if (note.kind === 'checklist') {
    raw = (note.items ?? []).map((item) => `${item.done ? '✓' : '○'} ${item.text}`).join('  ');
  } else if (note.kind === 'qa') {
    raw = (note.pairs ?? []).map((pair) => `؟ ${pair.question}`).join('  ');
  } else if (note.kind === 'table') {
    const { columns, rows } = note.table ?? { columns: [], rows: [] };
    raw = [
      columns.map((column) => column.label).join(' | '),
      (rows[0] ? columns.map((column) => rows[0].cells?.[column.id] ?? '').join(' | ') : ''),
    ].filter(Boolean).join('  —  ');
  } else {
    raw = note.body;
  }

  const flat = String(raw || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) return flat;
  return `${flat.slice(0, maxChars).trim()}…`;
}

/* پیش‌نمایش پیشرفت چک‌لیست برای کارت‌ها */
export function checklistProgress(note) {
  const items = note.items ?? [];
  const done = items.filter((item) => item.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/* متریک کارت — UI بر اساس type تصمیم می‌گیرد نوار پیشرفت یا شمارنده نشان بدهد */
export function noteMetrics(note) {
  const kind = note?.kind ?? 'text';
  if (kind === 'checklist') return { type: 'progress', ...checklistProgress(note) };
  if (kind === 'qa') return { type: 'count', icon: 'qa', count: (note.pairs ?? []).length, unit: 'پرسش' };
  if (kind === 'table') {
    const { columns, rows } = note.table ?? { columns: [], rows: [] };
    return { type: 'count', icon: 'table', count: rows.length, columns: columns.length, unit: 'ردیف' };
  }
  return { type: 'none' };
}

/* همهٔ متن‌های یک یادداشت — برای جست‌وجو، بازنویسی هوشمند و آمار */
export function noteTexts(note) {
  if (!note) return [];
  if (note.kind === 'checklist') return (note.items ?? []).map((item) => item.text);
  if (note.kind === 'qa') return (note.pairs ?? []).flatMap((pair) => [pair.question, pair.answer]);
  if (note.kind === 'table') {
    const { columns, rows } = note.table ?? { columns: [], rows: [] };
    return [...columns.map((column) => column.label), ...rows.flatMap((row) => columns.map((column) => row.cells?.[column.id] ?? ''))];
  }
  return [note.body ?? ''];
}

/* فیلتر + مرتب‌سازی — منطق در سرویس می‌ماند تا UI فقط رندر کند.
   sort: 'updated' | 'created' | 'title' — پین‌شده‌ها همیشه جلوتر از بقیه‌اند. */
export function filterNotes(notes, { query = '', subjectId = 'all', tag = null, sort = 'updated' } = {}) {
  const needle = normalizeForSearch(query).trim();

  const matched = notes.filter((note) => {
    if (subjectId !== 'all' && note.subjectId !== subjectId) return false;
    if (tag && !(note.tags ?? []).includes(tag)) return false;
    if (!needle) return true;
    const haystack = normalizeForSearch(
      [
        note.title,
        note.body,
        (note.tags ?? []).join(' '),
        subjectLabel(note.subjectId),
        note.source?.title ?? '',
        noteTexts(note).join(' '),
      ].join(' '),
    );
    return haystack.includes(needle);
  });

  const collator = new Intl.Collator('fa');
  return [...matched].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'title') return collator.compare(a.title, b.title);
    const field = sort === 'created' ? 'createdAt' : 'updatedAt';
    return new Date(b[field]) - new Date(a[field]);
  });
}

/* تگ‌های کاربر — **بدون دسته‌بندی**؛ یک فهرست تخت، پرکاربردترین اول.
   منطق شمارش و ترتیب در سرویس می‌ماند تا UI فقط رندر کند. */
export function collectTags(notes) {
  const counts = new Map();
  (notes ?? []).forEach((note) => (note.tags ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, accent: tagAccent(tag) }))
    .sort((a, b) => (b.count - a.count) || new Intl.Collator('fa').compare(a.tag, b.tag));
}

/* رنگ تگ — از خودِ متن تگ هش می‌شود: هر تگ رنگ تصادفیِ خودش را می‌گیرد و همان تگ
   همیشه همان رنگ را دارد (پایدار بین کارت فهرست، نمای کامل و ویرایشگر). */
export function tagAccent(tag) {
  const text = String(tag ?? '').trim();
  if (!text) return TAG_COLORS[0];
  /* FNV-1a ۳۲بیتی — پخش یکنواخت رنگ‌ها روی پالت (هش سادهٔ ضربی سوگیری داشت) */
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return TAG_COLORS[(hash >>> 0) % TAG_COLORS.length];
}

/* ─────────────────────────── عملیات CRUD ─────────────────────────── */

const KIND_IDS = ['text', 'checklist', 'qa', 'table'];

/* جفت‌های پرسش/پاسخ — پرسش بدون متن ذخیره نمی‌شود (پاسخ می‌تواند خالی بماند تا بعداً پر شود) */
function sanitizePairs(raw) {
  return (raw ?? [])
    .map((pair) => ({
      id: pair.id || makeId('qa'),
      question: String(pair.question ?? '').trim(),
      answer: String(pair.answer ?? '').trim(),
    }))
    .filter((pair) => pair.question)
    .slice(0, 60);
}

/* جدول مقایسه: حداقل ۲ ستون (اولی ستون معیار) و حداقل یک ردیف غیرخالی */
function sanitizeTable(raw) {
  const columns = (raw?.columns ?? [])
    .map((column) => ({ id: column.id || makeId('col'), label: String(column.label ?? '').trim() }))
    .filter((column) => column.label)
    .slice(0, 5);
  if (columns.length < 2) return { columns: [], rows: [] };

  const rows = (raw?.rows ?? [])
    .map((row) => ({
      id: row.id || makeId('row'),
      cells: Object.fromEntries(columns.map((column) => [column.id, String(row.cells?.[column.id] ?? '').trim()])),
    }))
    .filter((row) => columns.some((column) => row.cells[column.id]))
    .slice(0, 40);

  return rows.length ? { columns, rows } : { columns: [], rows: [] };
}

function sanitizeDraft(draft) {
  const kind = KIND_IDS.includes(draft.kind) ? draft.kind : 'text';
  const items = kind === 'checklist'
    ? (draft.items ?? [])
        .map((item) => ({ id: item.id || makeId('ck'), text: String(item.text || '').trim(), done: Boolean(item.done) }))
        .filter((item) => item.text)
    : [];
  const sourceType = draft.sourceType ?? null;
  const sourceTitle = String(draft.sourceTitle ?? '').trim();
  return {
    title: String(draft.title ?? '').trim(),
    kind,
    body: kind === 'text' ? String(draft.body ?? '').trim() : '',
    items,
    pairs: kind === 'qa' ? sanitizePairs(draft.pairs) : [],
    table: kind === 'table' ? sanitizeTable(draft.table) : { columns: [], rows: [] },
    subjectId: SUBJECTS.some((s) => s.id === draft.subjectId) ? draft.subjectId : 'general',
    tags: [...new Set((draft.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8),
    color: NOTE_COLORS.includes(draft.color) ? draft.color : NOTE_COLORS[1],
    pinned: Boolean(draft.pinned),
    source: sourceType && sourceTitle ? { sourceType, title: sourceTitle } : null,
  };
}

const isUsable = (note) =>
  note.title ||
  note.body ||
  (note.items ?? []).some((item) => item.text) ||
  (note.pairs ?? []).length > 0 ||
  (note.table?.rows ?? []).length > 0;

export function fetchNotes(userData) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    return { notes: getUserSpace(userData).notes };
  });
}

export function createNote(userData, draft) {
  const clean = sanitizeDraft(draft);
  if (!isUsable(clean)) return Promise.reject(new Error('empty-note'));

  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    const now = new Date().toISOString();
    const note = {
      id: makeId('note'),
      userId: userData?.id ?? 'guest',
      ...clean,
      createdAt: now,
      updatedAt: now,
    };
    mutateUserSpace(userData, (space) => {
      space.notes = [note, ...space.notes];
    });
    return note;
  });
}

export function updateNote(userData, noteId, patch) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    let updated = null;
    mutateUserSpace(userData, (space) => {
      space.notes = space.notes.map((note) => {
        if (note.id !== noteId) return note;
        updated = {
          ...note,
          ...sanitizeDraft({ ...note, ...patch }),
          id: note.id,
          userId: note.userId,
          createdAt: note.createdAt,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      });
    });
    return updated;
  });
}

export function deleteNote(userData, noteId) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    mutateUserSpace(userData, (space) => {
      space.notes = space.notes.filter((note) => note.id !== noteId);
    });
    return { id: noteId };
  });
}

export function setNotePinned(userData, noteId, pinned) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    let updated = null;
    mutateUserSpace(userData, (space) => {
      space.notes = space.notes.map((note) => {
        if (note.id !== noteId) return note;
        updated = { ...note, pinned: Boolean(pinned), updatedAt: new Date().toISOString() };
        return updated;
      });
    });
    return updated;
  });
}

/* toggle آیتم چک‌لیست — ویرایش محسوب نمی‌شود تا updatedAt کارت‌ها بالا نپرد */
export function toggleChecklistItem(userData, noteId, itemId) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    let updated = null;
    mutateUserSpace(userData, (space) => {
      space.notes = space.notes.map((note) => {
        if (note.id !== noteId) return note;
        updated = {
          ...note,
          items: (note.items ?? []).map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item,
          ),
        };
        return updated;
      });
    });
    return updated;
  });
}

/* ── تاریخ‌ها ── */

export function formatNoteDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export function relativeEditedAt(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'دیروز';
  if (days < 7) return `${days} روز پیش`;
  if (days < 30) return `${Math.floor(days / 7)} هفته پیش`;
  return formatNoteDate(iso);
}

/* ─────────────────── تپش هوشمند: پاکنویسی و بازنویسی هر متن ───────────────────
 * روی هر متن (بدنه، آیتم چک‌لیست، پرسش/پاسخ، سلول جدول) و روی کل یادداشت کار می‌کند.
 * پیاده‌سازی فعلی محلی و قطعی است (Mock) و متن را واقعاً مرتب می‌کند؛ با اتصال Backend
 * همین امضا به یک فراخوان مدل تبدیل می‌شود:
 *   POST /api/ai/notes/rewrite  { action, text }  →  استریم SSE
 * UI فقط دو حالت «متن کامل» یا «خطا» می‌بیند؛ لغو با AbortController.signal.
 */

export const NOTE_AI_ACTIONS = [
  { id: 'polish', label: 'پاکنویسی', hint: 'املا، فاصله و نقطه‌گذاری را مرتب می‌کند' },
  { id: 'bullets', label: 'بولت‌گذاری', hint: 'متن را به نکته‌های کوتاه و مرتب می‌شکند' },
  { id: 'summarize', label: 'خلاصه‌سازی', hint: 'فقط نکته‌های کلیدی را نگه می‌دارد' },
  { id: 'simplify', label: 'ساده‌سازی', hint: 'جمله‌های بلند را کوتاه و روان می‌کند' },
];

const BULLET_LINE = /^[•▪●○◦\-–—*✓✔]/;
const KEY_LINE = /(نکته|کلیدی|مهم|خلاصه|آزمون|high.?yield|حفظ|فرمول|قاعده|تفاوت|درمان|عوارض|مکانیزم|جمع‌بندی|همیشه|هرگز)/i;
const SIMPLE_SWAPS = [
  [/لذا/g, 'پس'],
  [/بدین\s?ترتیب/g, 'این‌طور'],
  [/علی\s?رغم|علیٰرغم/g, 'با وجود'],
  [/می‌باشد/g, 'است'],
  [/می‌گردد|گردید/g, 'شد'],
  [/می‌نماید|نمود/g, 'کرد'],
  [/جهتِ?\s/g, 'برای '],
  [/نظر\s?به\s?اینکه/g, 'چون'],
  [/در\s?نتیجهٔ/g, 'پس'],
  [/به\s?عبارت\s?دیگر/g, 'یعنی'],
  [/قابل\s?ذکر\s?است\s?که\s?/g, ''],
];

/* یکدست‌سازی فارسی: ي/ك عربی، فاصله‌های اضافه، فاصلهٔ غلط قبل و بعد نقطه‌گذاری */
function normalizeFa(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c{2,}/g, '\u200c')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([،؛؟!»])/g, '$1')
    .replace(/([،؛؟!])(?=[^\s\d])/g, '$1 ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const stripBullet = (line) => line.replace(/^[\s•▪●○◦\-–—*✓✔]+/, '').replace(/^\d+[.)]\s*/, '').trim();
const splitSentences = (text) => text.split(/(?<=[.؟!؛])\s+/).map((part) => part.trim()).filter(Boolean);
const trimPunctuation = (text) => text.replace(/^[،؛:]\s*/, '').replace(/[،؛]\s*$/, '').trim();

function polishText(text) {
  return normalizeFa(text)
    .split('\n')
    .map((line) => {
      const raw = line.trim();
      if (!raw) return '';
      const bullet = BULLET_LINE.test(raw);
      const body = bullet ? stripBullet(raw) : raw;
      if (!body) return '';
      const closed = body.length > 24 && !/[.؟!؛:]$/.test(body) ? `${body}.` : body;
      return bullet ? `• ${closed}` : closed;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function bulletsText(text) {
  const out = [];
  normalizeFa(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const body = stripBullet(line);
      if (!body) return;
      const parts = body.length > 110 ? splitSentences(body) : [body];
      parts.forEach((part) => {
        const clean = trimPunctuation(part);
        if (clean) out.push(`• ${clean}`);
      });
    });
  return out.join('\n');
}

function summarizeText(text) {
  const lines = normalizeFa(text).split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  const keyed = lines.filter((line) => KEY_LINE.test(line));
  /* خط اول (تعریف/موضوع اصلی) همیشه می‌ماند، بعد خطوط کلیدی */
  const base = keyed.length ? [lines[0], ...keyed.filter((line) => line !== lines[0])] : lines.slice(0, Math.max(1, Math.ceil(lines.length / 2)));
  return base
    .map((line) => {
      const bullet = BULLET_LINE.test(line);
      const body = stripBullet(line);
      const sentences = splitSentences(body);
      const kept = sentences.length > 1 ? sentences[0] : body;
      return bullet ? `• ${kept}` : kept;
    })
    .join('\n');
}

function simplifyText(text) {
  let out = normalizeFa(text);
  SIMPLE_SWAPS.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement);
  });
  return out
    .split('\n')
    .map((line) => {
      const bullet = BULLET_LINE.test(line.trim());
      const body = stripBullet(line);
      const sentences = splitSentences(body);
      const shortened = sentences.flatMap((sentence) => (sentence.length > 90 ? sentence.split(/؛\s*/).map((part) => part.trim()).filter(Boolean) : [sentence]));
      return shortened.map((sentence) => `${bullet ? '• ' : ''}${sentence}`).join('\n');
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ?([،؛.؟!])/g, '$1')
    .trim();
}

/* بازنویسی یک متن — هستهٔ مشترک استریم و بازنویسی کل یادداشت */
export function rewriteText(text, action = 'polish') {
  const source = String(text ?? '');
  if (!source.trim()) return '';
  if (action === 'bullets') return bulletsText(source);
  if (action === 'summarize') return summarizeText(source);
  if (action === 'simplify') return simplifyText(source);
  return polishText(source);
}

function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Aborted', 'AbortError');
  return Object.assign(new Error('Aborted'), { name: 'AbortError' });
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/* استریم بازنویسی یک متن — onChunk هر بار «کل متن تا این لحظه» را می‌گیرد */
export async function runNoteAI({ action = 'polish', text = '', signal, onChunk } = {}) {
  const output = rewriteText(text, action);
  if (!output) return '';
  const tokens = output.match(/\s+|[^\s]+/g) ?? [output];
  let full = '';
  for (let index = 0; index < tokens.length; index += 3) {
    await wait(26, signal);
    full += tokens.slice(index, index + 3).join('');
    onChunk?.(full);
  }
  return full;
}

/* بازنویسی همهٔ متن‌های یک یادداشت/پیش‌نویس — بدون استریم، با همان تأخیر بقیهٔ mutationها */
export function rewriteDraft(draft, action = 'polish') {
  if (!draft) return draft;
  const kind = KIND_IDS.includes(draft.kind) ? draft.kind : 'text';
  const next = { ...draft, kind };

  if (kind === 'text') {
    next.body = rewriteText(draft.body, action);
  } else if (kind === 'checklist') {
    next.items = (draft.items ?? []).map((item) => ({ ...item, text: rewriteText(item.text, action) }));
  } else if (kind === 'qa') {
    next.pairs = (draft.pairs ?? []).map((pair) => ({
      ...pair,
      question: rewriteText(pair.question, action),
      answer: rewriteText(pair.answer, action),
    }));
  } else {
    const columns = draft.table?.columns ?? [];
    next.table = {
      columns: columns.map((column) => ({ ...column, label: rewriteText(column.label, action) })),
      rows: (draft.table?.rows ?? []).map((row) => ({
        id: row.id,
        cells: Object.fromEntries(columns.map((column) => [column.id, rewriteText(row.cells?.[column.id] ?? '', action)])),
      })),
    };
  }

  return next;
}

export function runNoteAIOnNote({ note, action = 'polish' }) {
  return respond(() => {
    if (simulateFailure) throw new Error('notes-unavailable');
    return rewriteDraft(note, action);
  });
}
