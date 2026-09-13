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

import { NOTE_COLORS, SEED_NOTES, SUBJECTS } from './mockData';

/* برای مصرف‌کننده‌ها: متادیتای دامنه از یک منبع (سرویس) خوانده شود */
export { NOTE_COLORS, SOURCE_TYPES, SUBJECTS } from './mockData';

const STORAGE_KEY = 'tapesh:notes:v1';
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

function readStore() {
  if (typeof window === 'undefined') return {};
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

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/* Seed اولیه: یادداشت‌های نمونهٔ تپش با تاریخ‌های نسبی واقعی */
function seedUserSpace(userData) {
  const userId = userData?.id ?? 'guest';
  return {
    notes: SEED_NOTES.map((note) => ({
      id: makeId('note'),
      userId,
      title: note.title,
      kind: note.kind,
      body: note.body,
      items: (note.items ?? []).map((item) => ({ ...item })),
      subjectId: note.subjectId,
      tags: [...note.tags],
      color: note.color,
      pinned: note.pinned,
      source: note.source ? { ...note.source } : null,
      createdAt: daysAgo(note.dayOffsets.created),
      updatedAt: daysAgo(note.dayOffsets.updated),
    })),
  };
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
export const noteColor = (note) => NOTE_COLORS.includes(note?.color) ? note.color : '#5b8cc7';

/* نرمال‌سازی متن برای جست‌وجو: فارسی/عربی و نیم‌فاصله به هم برسند */
function normalizeForSearch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ');
}

/* متن خلاصهٔ کارت: از بدنه یا آیتم‌های چک‌لیست ساخته می‌شود */
export function buildSnippet(note, maxChars = 140) {
  const raw =
    note.kind === 'checklist'
      ? (note.items ?? []).map((item) => `${item.done ? '✓' : '○'} ${item.text}`).join('  ')
      : note.body;
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

/* فیلتر + مرتب‌سازی — منطق در سرویس می‌ماند تا UI فقط رندر کند.
   sort: 'updated' | 'created' | 'title' — پین‌شده‌ها همیشه جلوتر از بقیه‌اند. */
export function filterNotes(notes, { query = '', subjectId = 'all', sort = 'updated' } = {}) {
  const needle = normalizeForSearch(query).trim();

  const matched = notes.filter((note) => {
    if (subjectId !== 'all' && note.subjectId !== subjectId) return false;
    if (!needle) return true;
    const haystack = normalizeForSearch(
      [
        note.title,
        note.body,
        (note.tags ?? []).join(' '),
        subjectLabel(note.subjectId),
        note.source?.title ?? '',
        (note.items ?? []).map((item) => item.text).join(' '),
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

/* ─────────────────────────── عملیات CRUD ─────────────────────────── */

function sanitizeDraft(draft) {
  const kind = draft.kind === 'checklist' ? 'checklist' : 'text';
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
    subjectId: SUBJECTS.some((s) => s.id === draft.subjectId) ? draft.subjectId : 'general',
    tags: [...new Set((draft.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8),
    color: NOTE_COLORS.includes(draft.color) ? draft.color : NOTE_COLORS[1],
    pinned: Boolean(draft.pinned),
    source: sourceType && sourceTitle ? { sourceType, title: sourceTitle } : null,
  };
}

const isUsable = (note) =>
  note.title || note.body || (note.items ?? []).some((item) => item.text);

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
