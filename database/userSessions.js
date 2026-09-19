/*
 * سشن کاربران سایت — فایل‌پشتیبان.
 *
 * چرا فایل و نه حافظهٔ پروسه (برخلاف سشن ادمین)؟ آزمون جلسه‌ای دوساعته است؛
 * ری‌استارت سرور نباید هویت شرکت‌کننده را وسط Attempt پاک کند.
 *
 * توکن ۳۲ بایت CSPRNG است و فقط این فایل به آن اعتماد می‌کند؛ کوکی مرورگر
 * HttpOnly است (در examApi.js و apiPlugin.js ست می‌شود) و هیچ دادهٔ امنیتی در
 * localStorage کلاینت نمی‌نشیند.
 *
 * انقضا: absolute با تمدید لغزنده — اگر بیش از نیمی از عمر سشن گذشته باشد،
 * در اولین اعتبارسنجی تمدید می‌شود. حذف کاربر از users.json سشن‌هایش را
 * بی‌اعتبار می‌کند (lazy revoke).
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findUserById } from './usersStore.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const sessionsFile = join(databaseDir, 'users.sessions.json');

export const USER_SESSION_COOKIE = 'tapesh_user_session';
export const USER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; /* هفت روز با تمدید لغزنده */
const RENEW_THRESHOLD_MS = USER_SESSION_TTL_MS / 2;

let cache = null; /* {sessions: {token: record}} — نوشتن همیشه از طریق writeSessions */

function ensureFile() {
  if (!existsSync(databaseDir)) mkdirSync(databaseDir, { recursive: true });
  if (!existsSync(sessionsFile)) {
    writeFileSync(sessionsFile, JSON.stringify({ sessions: {} }, null, 2), 'utf8');
  }
}

function readSessions() {
  if (cache) return cache;
  ensureFile();
  try {
    const parsed = JSON.parse(readFileSync(sessionsFile, 'utf8'));
    cache = parsed && typeof parsed.sessions === 'object' && parsed.sessions ? parsed : { sessions: {} };
  } catch {
    cache = { sessions: {} };
  }
  return cache;
}

/* نوشتن اتمیک (tmp + rename) — کرش وسط نوشتن فایل سشن را خراب نمی‌کند */
function writeSessions(data) {
  ensureFile();
  const tmp = `${sessionsFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, sessionsFile);
  cache = data;
}

function sweepExpired(data, now = Date.now()) {
  for (const [token, record] of Object.entries(data.sessions)) {
    if (!record || record.expiresAt <= now) delete data.sessions[token];
  }
}

export function createUserSession(user, { ip = '', userAgent = '', anonymous = false } = {}) {
  const data = readSessions();
  sweepExpired(data);

  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  data.sessions[token] = {
    userId: anonymous ? String(user.id) : user.id,
    anonymous: Boolean(anonymous),
    createdAt: now,
    expiresAt: now + USER_SESSION_TTL_MS,
    lastSeenAt: now,
    ip: String(ip).slice(0, 64),
    userAgent: String(userAgent).slice(0, 256),
  };
  writeSessions(data);
  return { token, expiresAt: data.sessions[token].expiresAt };
}

/*
 * اعتبارسنجی توکن → {user, session} یا null.
 * برای سشن ناشناس (آزمونک مهمان) هویت همان id سشن است؛ برای سشن واقعی، وجود
 * کاربر دوباره چک می‌شود تا حذف حساب، سشن‌های باقی‌مانده را باطل کند.
 */
export function getUserSession(token) {
  if (!token) return null;
  const data = readSessions();
  const record = data.sessions[token];
  const now = Date.now();

  if (!record || record.expiresAt <= now) return null;

  if (record.anonymous) {
    return { user: { id: record.userId, anonymous: true }, session: record };
  }

  const user = findUserById(record.userId);
  if (!user) {
    delete data.sessions[token];
    writeSessions(data);
    return null;
  }

  /* تمدید لغزنده — فقط وقتی بیش از نیمی از عمر گذشته تا نوشتن فایل کم شود */
  if (record.expiresAt - now < RENEW_THRESHOLD_MS) {
    record.expiresAt = now + USER_SESSION_TTL_MS;
    record.lastSeenAt = now;
    writeSessions(data);
  }

  return { user, session: record };
}

export function destroyUserSession(token) {
  if (!token) return;
  const data = readSessions();
  if (data.sessions[token]) {
    delete data.sessions[token];
    writeSessions(data);
  }
}

/* حذف همهٔ سشن‌های یک کاربر (برای «خروج از همه‌جا» یا حذف حساب) */
export function destroyUserSessionsFor(userId) {
  const data = readSessions();
  let changed = false;
  for (const [token, record] of Object.entries(data.sessions)) {
    if (record && record.userId === userId) {
      delete data.sessions[token];
      changed = true;
    }
  }
  if (changed) writeSessions(data);
}

/* مسیر فایل — برای تست‌ها و ابزار نگهداری */
export const sessionFilePath = resolve(sessionsFile);
