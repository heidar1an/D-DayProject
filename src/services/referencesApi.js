/* ── لایه سرویس مراجع (Reference Reader API) ──
   قرارداد API برای اتصال به بک‌اند:
     GET    /references                       → listReferences()
     GET    /references/:id                   → getReference(id)          (متادیتا + پیشرفت + آخرین مطالعه)
     GET    /chapters/:id                     → getChapterContent(_, id)  (بخش‌ها و بلوک‌های محتوا)
     GET    /references/:id/search?q=         → searchReference(id, q)
     POST   /highlights | DELETE /highlights/:id
     POST   /notes      | DELETE /notes/:id
     POST   /bookmarks  | DELETE /bookmarks/:id
     PUT    /me/reader-settings
   الان همه‌چیز با داده موک + localStorage جواب می‌دهد؛ برای اتصال به بک‌اند کافی است
   هر تابع به fetch همین مسیرها تبدیل شود — هیچ کامپوننتی به جزئیات mock وابسته نیست.
   توجه حفاظت محتوا: در نسخه واقعی، متن بلوک‌ها فقط از بک‌اند و برای کاربر دارای
   Authorization برگردانده می‌شود و جلوی استخراج انبوه سمت سرور گرفته می‌شود. */

import anatomyFigure from '../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۴_۱۳.png';
import histologyFigure from '../../images/courses/QW2X7THz15isfPOypUmHX3UULX8-zM29LGSsSUChN3UXdLb3uQ.png';
import { REFERENCE_CATALOG, REFERENCE_CONTENTS } from './references/referenceCatalog.js';

/* ─────────────────────────── متادیتای مراجع ─────────────────────────── */

/*
 * فرادادهٔ مرجع‌ها از کاتالوگ می‌آید: همان فهرستی که سرور (`contentStore`) برای
 * seed رکوردهای پنل می‌خواند — یک منبع حقیقت، دو مصرف‌کننده.
 */
export const REFERENCES = REFERENCE_CATALOG;

/* ─────────────────────────── محتوای فصل‌ها ───────────────────────────
   متن فصل‌ها در کاتالوگ خالص زندگی می‌کند (`referenceCatalog.js`) تا سرور هم برای
   seed پنل همان را بخواند — یک منبع حقیقت. بلوک `image` در کاتالوگ فقط کلید دارد؛
   آدرس واقعی تصویر اینجا با import وصل می‌شود چون کاتالوگ باید خالص بماند. */

const FIGURES = { anatomy: anatomyFigure, histology: histologyFigure };

const withFigures = (content) => ({
  sections: content.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => (
      block.figure ? { ...block, src: FIGURES[block.figure] ?? undefined } : block
    )),
  })),
});

const CHAPTER_CONTENTS = Object.fromEntries(
  Object.entries(REFERENCE_CONTENTS).map(([chapterId, content]) => [chapterId, withFigures(content)]),
);

let published = null;
let publishedPending = null;

async function loadPublished({ force = false } = {}) {
  if (!force && published) return published;
  if (publishedPending) return publishedPending;
  publishedPending = (async () => {
    try {
      const response = await fetch('/api/public/references/library', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('REFERENCE_LIBRARY_UNAVAILABLE');
      const payload = await response.json();
      if (!Array.isArray(payload?.data?.references)) throw new Error('INVALID_REFERENCE_LIBRARY');
      published = payload.data.references.map((record) => ({
        ...record,
        chapters: (record.sections ?? []).map((section, index) => ({
          id: section.id,
          title: section.title,
          number: index + 1,
          sections: (section.topics ?? []).length,
          minutes: Math.max(1, Math.ceil((section.topics ?? []).reduce((sum, topic) =>
            sum + String(topic.content ?? '').replace(/<[^>]*>/g, '').length, 0) / 800)),
          topics: section.topics ?? [],
        })),
      }));
    } catch (error) {
      // خطای دریافت تازه نباید نسخهٔ قبلی را به‌جای متن ویرایش‌شده نشان دهد.
      if (force && published) throw error;
      // پیش‌نمایش ایستا همچنان از کاتالوگ داخلی استفاده می‌کند.
      if (!published) published = REFERENCES;
    } finally {
      publishedPending = null;
    }
    return published;
  })();
  return publishedPending;
}

/* ─────────────────────────── ابزارهای داخلی ─────────────────────────── */

const delay = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

const makeId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

/* نگهداری داده‌های کاربر (هایلایت/نوت/بوکمارک/پیشرفت/تنظیمات) — الان localStorage؛
   در نسخه بک‌اند این توابع POST/DELETE می‌شوند و شناسه کاربر از توکن می‌آید. */
const STORE_PREFIX = 'tapesh:reader';

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStore = (key, value) => {
  try {
    localStorage.setItem(`${STORE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    /* حافظه پر یا غیرفعال — عملیات خواندن همچنان کار می‌کند */
  }
};

const userId = () => readStore('user', 'local-user');

/* شناسه قطعی بلوک: برای لنگر کردن هایلایت/نوت به متن، مستقل از رندر */
export const blockId = (chapterId, sectionId, index) => `${chapterId}|${sectionId}|${index}`;

const decorate = (content, chapterId) => ({
  sections: content.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((b, i) => ({ ...b, id: blockId(chapterId, section.id, i) })),
  })),
});

/* ─────────────────────────── API عمومی ─────────────────────────── */

export async function listReferences() {
  const references = await loadPublished({ force: true });
  return references.map((reference) => ({ ...reference, chapterCount: reference.chapters.length }));
}

/* GET /references/:id — متادیتا + وضعیت مطالعه همان کاربر */
export async function getReference(id) {
  await delay(280);
  const references = await loadPublished({ force: true });
  const reference = references.find((ref) => ref.id === id);
  if (!reference) throw new Error('REFERENCE_NOT_FOUND');
  return {
    reference,
    progress: readStore(`${id}:progress`, {}),
    lastRead: readStore(`${id}:lastread`, null),
  };
}

/* GET /chapters/:id — محتوای ساختاریافته فصل (فقط برای کاربر دارای دسترسی) */
export async function getChapterContent(referenceId, chapterId) {
  await delay(420);
  const references = await loadPublished({ force: true });
  const reference = references.find((ref) => ref.id === referenceId);
  const chapter = reference?.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) throw new Error('CHAPTER_NOT_FOUND');
  if (chapter.topics) {
    if (!chapter.topics.length) {
      const error = new Error('CONTENT_NOT_AVAILABLE');
      error.code = 'CONTENT_NOT_AVAILABLE';
      throw error;
    }
    return decorate({ sections: chapter.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      blocks: topic.content ? [{ type: 'html', html: topic.content }] : [],
    })) }, chapterId);
  }
  const raw = CHAPTER_CONTENTS[chapterId];
  if (!raw) {
    const error = new Error('CONTENT_NOT_AVAILABLE');
    error.code = 'CONTENT_NOT_AVAILABLE';
    throw error;
  }
  return decorate(raw, chapterId);
}

/* GET /references/:id/search?q= — جست‌وجوی متنی؛ در آینده semantic می‌شود */
export async function searchReference(referenceId, query) {
  await delay(180);
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const references = await loadPublished({ force: true });
  const reference = references.find((ref) => ref.id === referenceId);
  if (!reference) return [];

  const results = [];
  for (const chapter of reference.chapters) {
    const raw = chapter.topics
      ? { sections: chapter.topics.map((topic) => ({
        id: topic.id, title: topic.title,
        blocks: [{ type: 'html', html: topic.content ?? '' }],
      })) }
      : CHAPTER_CONTENTS[chapter.id];
    if (!raw) continue;
    for (const section of raw.sections) {
      section.blocks.forEach((b, index) => {
        const text =
          b.type === 'table'
            ? [b.caption, ...b.headers, ...b.rows.flat()].join(' ')
            : b.type === 'callout'
              ? `${b.title ?? ''} ${b.text}`
              : b.type === 'image'
                ? `${b.caption ?? ''}`
                : b.type === 'html'
                  ? b.html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
                  : b.text ?? '';
        const at = text.toLowerCase().indexOf(term);
        if (at === -1 || results.length >= 40) return;
        const from = Math.max(0, at - 42);
        results.push({
          blockId: blockId(chapter.id, section.id, index),
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          sectionId: section.id,
          sectionTitle: section.title,
          snippet: `${from > 0 ? '…' : ''}${text.slice(from, at + term.length + 60).trim()}…`,
          matchLength: term.length,
        });
      });
      if (results.length >= 40) break;
    }
    if (results.length >= 40) break;
  }
  return results;
}

/* ── داده‌های تعاملی کاربر ── */

const readList = (referenceId, kind) => readStore(`${referenceId}:${kind}`, []);

export async function loadReaderState(referenceId) {
  await delay(160);
  return {
    userId: userId(),
    settings: readStore('settings', null),
    highlights: readList(referenceId, 'highlights'),
    notes: readList(referenceId, 'notes'),
    bookmarks: readList(referenceId, 'bookmarks'),
    progress: readStore(`${referenceId}:progress`, {}),
    lastRead: readStore(`${referenceId}:lastread`, null),
  };
}

const addToList = async (referenceId, kind, item) => {
  await delay(120);
  const list = readList(referenceId, kind);
  list.push(item);
  writeStore(`${referenceId}:${kind}`, list);
  return item;
};

const removeFromList = async (referenceId, kind, itemId) => {
  await delay(120);
  writeStore(
    `${referenceId}:${kind}`,
    readList(referenceId, kind).filter((item) => item.id !== itemId),
  );
  return itemId;
};

/* POST /highlights */
export const saveHighlight = (referenceId, highlight) =>
  addToList(referenceId, 'highlights', { ...highlight, id: makeId(), createdAt: Date.now() });
/* DELETE /highlights/:id */
export const deleteHighlight = (referenceId, id) => removeFromList(referenceId, 'highlights', id);

/* POST /notes */
export const saveNote = (referenceId, note) =>
  addToList(referenceId, 'notes', { ...note, id: makeId(), createdAt: Date.now() });
/* DELETE /notes/:id */
export const deleteNote = (referenceId, id) => removeFromList(referenceId, 'notes', id);

/* POST /bookmarks — هر بوکمارک به یک بخش از یک فصل لنگر می‌شود */
export const saveBookmark = (referenceId, bookmark) =>
  addToList(referenceId, 'bookmarks', { ...bookmark, id: makeId(), createdAt: Date.now() });
/* DELETE /bookmarks/:id */
export const deleteBookmark = (referenceId, id) => removeFromList(referenceId, 'bookmarks', id);

/* PUT /me/reader-settings — تنظیمات خواندن بین همه مراجع مشترک است */
export async function saveSettings(settings) {
  await delay(100);
  writeStore('settings', settings);
  return settings;
}

/* PUT /references/:id/progress — بخش‌های دیده‌شده هر فصل */
export async function saveProgress(referenceId, chapterId, seenSections) {
  const progress = readStore(`${referenceId}:progress`, {});
  progress[chapterId] = { seen: [...new Set(seenSections)], at: Date.now() };
  writeStore(`${referenceId}:progress`, progress);
  return progress;
}

/* PUT /references/:id/last-read — برای بازگشایی دقیق از همان نقطه */
export async function saveLastRead(referenceId, lastRead) {
  writeStore(`${referenceId}:lastread`, { ...lastRead, at: Date.now() });
  return lastRead;
}

/* نتیجه جست‌وجو فقط برای فصل‌های در دسترس معنا دارد؛ در UI نمایش داده می‌شود */
export const chapterLabel = (chapter) => `فصل ${chapter.number} — ${chapter.title}`;
