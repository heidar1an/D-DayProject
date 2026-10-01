/*
 * انبار بازخورد کاربران سایت — پیشنهاد، انتقاد و گزارش‌هایی که سطوح مختلف تپش
 * به سرور می‌فرستند (فرم «راهنما و پشتیبانی»، بانک تست، درسنامه جامع، میکرو
 * درسنامه، آزمون‌ها و دوره‌های بین‌الملل).
 *
 * دو مجموعه در یک فایل:
 *   items   → خودِ گزارش‌ها؛ هر آیتم `source` دقیق دارد تا پنل بداند از کجا آمده
 *             و نام/نام کاربری/شمارهٔ فرستنده هم رویش نشسته است.
 *   replies → پاسخ‌های مدیر به همان گزارش‌ها؛ کلیدش `targetId` است (شناسهٔ نمایشی
 *             گزارش در پنل: `fb-…` یا `exam:…`). همین پاسخ‌ها در لایهٔ «اعلان‌ها»ی
 *             کاربر نمایش داده می‌شوند، پس `userId` فرستنده روی پاسخ هم می‌نشیند.
 *
 * ثبت append-only است؛ حذف فقط با دستور پنل انجام می‌شود.
 *
 * گزارش ایراد سؤال «آزمون‌های هماهنگ» از ابتدا سرورمحور بوده و در examStore
 * (examReports.json) می‌نشیند؛ ادغام دو منبع در `GET /api/admin/feedback` انجام
 * می‌شود ولی پاسخ‌های هر دو این‌جا نگه داشته می‌شوند.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const contentDir = join(databaseDir, 'content');
const feedbackFile = join(contentDir, 'feedback.json');

const MAX_SOURCE = 40;
const MAX_SUBJECT = 200;
const MAX_CATEGORY = 64;
const MAX_MESSAGE = 4000;
const MAX_REPLY = 2000;
const MAX_META_BYTES = 2000;

/* محدودیت نرخ سبک درون‌حافظه‌ای — هر IP در هر ساعت حداکثر ۱۲ پیام */
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map();

let store = null;

function readStore() {
  if (store) return store;
  try {
    const parsed = JSON.parse(readFileSync(feedbackFile, 'utf8'));
    store = {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      replies: Array.isArray(parsed?.replies) ? parsed.replies : [],
    };
  } catch {
    store = { items: [], replies: [] };
  }
  return store;
}

/* نوشتن اتمیک (tmp + rename) — کرش وسط نوشتن فایل را خراب نمی‌کند */
function writeStore() {
  if (!existsSync(contentDir)) mkdirSync(contentDir, { recursive: true });
  const tmp = `${feedbackFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(readStore(), null, 2), 'utf8');
  renameSync(tmp, feedbackFile);
}

export function allowFeedback(ip) {
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);

  if (bucket.length >= RATE_LIMIT) {
    rateBuckets.set(ip, bucket);
    return { allowed: false, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - bucket[0])) / 1000) };
  }

  bucket.push(now);
  rateBuckets.set(ip, bucket);
  return { allowed: true, retryAfter: 0 };
}

/*
 * هویت فرستنده — نام، نام کاربری و شمارهٔ کاربر سایت.
 *
 * دو شکل ورودی پذیرفته می‌شود: کاربر سشن سرور (با `profile`) و هویت سبکِ
 * کلاینتی که سایت می‌فرستد (`{ id, name, username, phone }`) — چون بخشی از
 * کاربران فقط نشست محلی مرورگر دارند.
 */
function identityOf(user) {
  if (!user) return { userId: null, userName: null, userUsername: null, userPhone: null };
  if (user.anonymous) return { userId: user.id ?? null, userName: 'مهمان', userUsername: null, userPhone: null };

  const profile = user.profile ?? {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const clientName = typeof user.name === 'string' ? user.name.trim() : '';

  return {
    userId: user.id ? String(user.id).slice(0, 64) : null,
    userName: fullName || clientName || profile.username || user.username || null,
    userUsername: profile.username || user.username || null,
    userPhone: user.phone ? String(user.phone).slice(0, 24) : null,
  };
}

export function addFeedback(payload = {}) {
  const subject = String(payload.subject ?? '').trim().slice(0, MAX_SUBJECT);
  const message = String(payload.message ?? '').trim().slice(0, MAX_MESSAGE);
  if (!subject && !message) return { error: 'empty' };

  let meta = null;
  if (payload.meta && typeof payload.meta === 'object') {
    try {
      const raw = JSON.stringify(payload.meta);
      if (raw.length <= MAX_META_BYTES) meta = JSON.parse(raw);
    } catch {
      /* فرادادهٔ خراب نادیده گرفته می‌شود */
    }
  }

  const item = {
    id: `fb-${randomBytes(8).toString('hex')}`,
    source: String(payload.source ?? '').trim().slice(0, MAX_SOURCE) || 'unknown',
    subject,
    category: String(payload.category ?? '').trim().slice(0, MAX_CATEGORY),
    message,
    ...identityOf(payload.user),
    meta,
    createdAt: Date.now(),
    status: 'open',
  };

  readStore().items.push(item);
  writeStore();
  return { item };
}

export function listFeedback() {
  return [...readStore().items].sort((a, b) => b.createdAt - a.createdAt);
}

export function setFeedbackStatus(id, status) {
  const item = readStore().items.find((row) => row.id === id);
  if (!item) return null;
  item.status = status === 'resolved' ? 'resolved' : 'open';
  writeStore();
  return { ...item };
}

export function removeFeedback(id) {
  const data = readStore();
  const index = data.items.findIndex((row) => row.id === id);
  if (index === -1) return false;
  data.items.splice(index, 1);
  /* پاسخ‌های همان گزارش هم می‌روند؛ وگرنه در اعلان‌های کاربر یتیم می‌مانند */
  data.replies = data.replies.filter((reply) => reply.targetId !== id);
  writeStore();
  return true;
}

/* ────────────────────────── پاسخ مدیر به گزارش ────────────────────────── */

export function addReply({ targetId, subject, source, userId, text, admin }) {
  const body = String(text ?? '').trim().slice(0, MAX_REPLY);
  if (!targetId || !body) return null;

  const reply = {
    id: `rp-${randomBytes(8).toString('hex')}`,
    targetId,
    userId: userId ?? null,
    subject: String(subject ?? '').slice(0, MAX_SUBJECT),
    source: String(source ?? '').slice(0, MAX_SOURCE),
    text: body,
    adminName: admin?.name || admin?.username || 'تیم تپش',
    adminId: admin?.id ?? null,
    createdAt: Date.now(),
    readAt: null,
  };

  readStore().replies.push(reply);
  writeStore();
  return { ...reply };
}

/* پاسخ‌ها به‌تفکیک شناسهٔ گزارش — برای نشان دادن زیر هر آیتم در پنل */
export function repliesByTarget() {
  const map = {};
  for (const reply of readStore().replies) {
    (map[reply.targetId] ??= []).push({ ...reply });
  }
  for (const list of Object.values(map)) list.sort((a, b) => a.createdAt - b.createdAt);
  return map;
}

/* پاسخ‌های یک کاربر سایت — ورودی لایهٔ «اعلان‌ها» */
export function listRepliesForUser(userId) {
  if (!userId) return [];
  return readStore().replies
    .filter((reply) => reply.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((reply) => ({ ...reply }));
}

export function markRepliesRead(userId) {
  if (!userId) return 0;
  const now = Date.now();
  let changed = 0;
  for (const reply of readStore().replies) {
    if (reply.userId === userId && !reply.readAt) {
      reply.readAt = now;
      changed += 1;
    }
  }
  if (changed) writeStore();
  return changed;
}

/* پاک‌کردن پاسخ‌های یک گزارش — وقتی گزارش از انبار آزمون هم حذف می‌شود */
export function removeRepliesForTarget(targetId) {
  const data = readStore();
  const before = data.replies.length;
  data.replies = data.replies.filter((reply) => reply.targetId !== targetId);
  if (data.replies.length !== before) writeStore();
}
