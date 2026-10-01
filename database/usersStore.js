/*
 * مخزن کاربران سایت (`database/users.json`).
 *
 * دو قاعدهٔ امنیتی که این فایل تضمین می‌کند:
 *
 *   ۱. **CREATE و UPDATE از هم جدا هستند.** `createUser` فقط می‌سازد و اگر
 *      شماره وجود داشته باشد با `USER_ALREADY_EXISTS` رد می‌کند؛ `updateUserProfileById`
 *      فقط پروفایل را عوض می‌کند و هیچ‌وقت به `passwordHash`/`id`/`createdAt` دست
 *      نمی‌زند. پیش‌تر یک `saveUser` واحد هر دو نقش را بازی می‌کرد و همین باعث
 *      «تصاحب حساب» بود: ثبت‌نام با شمارهٔ موجود، هش رمز را بازنویسی می‌کرد.
 *
 *   ۲. **رمز با scrypt + salt ذخیره می‌شود.** هش قدیمی `SHA-256` بدون salt
 *      (`database/users.json` نسخه‌های قبل) فقط برای *خواندن* پشتیبانی می‌شود و
 *      در اولین ورود موفق، خودکار به scrypt ارتقا پیدا می‌کند (migration تدریجی).
 *      هیچ مسیری هش scrypt را به SHA-256 برنمی‌گرداند.
 *
 * نوشتن فایل اتمیک است (tmp + rename) — کرش وسط نوشتن، `users.json` را خراب
 * نمی‌کند. همهٔ توابع همگام (sync) هستند و بین «خواندن → تصمیم → نوشتن» هیچ
 * `await`ای نیست؛ روی حلقهٔ تک‌رشته‌ای نود یعنی دو درخواست هم‌زمان ثبت‌نام
 * نمی‌توانند هر دو از فیلتر «شماره تکراری» رد شوند (نگاه کنید به بخش
 * Concurrency در `usersApi.js`).
 */

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePassword, validatePhone } from './authPolicy.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const usersFile = resolve(databaseDir, 'users.json');

export const PASSWORD_HASH_SCHEME = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

/* هش قدیمی: ۶۴ نویسهٔ hex بدون `$` — یعنی SHA-256 بدون salt */
const LEGACY_SHA256_PATTERN = /^[0-9a-f]{64}$/;

const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  username: '',
  university: '',
  term: '',
  motivations: [],
  referralSources: [],
};

export function authError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

/* ────────────────────────────── رمز عبور ────────────────────────────── */

export function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_BYTES).toString('hex');
  const derived = scryptSync(String(password), salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${PASSWORD_HASH_SCHEME}$${salt}$${derived}`;
}

/* هش قدیمی (SHA-256 بدون salt) — فقط برای تشخیص و مهاجرت */
export function isLegacyPasswordHash(stored) {
  return typeof stored === 'string' && LEGACY_SHA256_PATTERN.test(stored);
}

function verifyScryptHash(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== PASSWORD_HASH_SCHEME || !salt || !hash) return false;

  let expected;
  try {
    expected = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  if (!expected.length) return false;

  const derived = scryptSync(String(password), salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function verifyLegacySha256(password, stored) {
  return createHash('sha256').update(String(password)).digest('hex') === stored;
}

/*
 * تشخیص خودکار فرمت: scrypt → scrypt، SHA-256 → مقایسهٔ قدیمی.
 * مقایسه‌ها ثابت‌زمان (timingSafeEqual) هستند تا هش قابل حدس از اختلاف زمان
 * پاسخ خوانده نشود.
 */
export function verifyPasswordHash(password, stored) {
  if (typeof stored !== 'string' || !stored) return false;
  if (typeof password !== 'string' || !password) return false;

  if (isLegacyPasswordHash(stored)) {
    const legacy = Buffer.from(stored, 'utf8');
    const candidate = Buffer.from(
      createHash('sha256').update(password).digest('hex'),
      'utf8',
    );
    return legacy.length === candidate.length && timingSafeEqual(legacy, candidate);
  }

  return verifyScryptHash(password, stored);
}

/* ───────────────────────────── ابزار فایل ───────────────────────────── */

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .trim();
}

function ensureFile() {
  if (!existsSync(databaseDir)) {
    mkdirSync(databaseDir, { recursive: true });
  }

  if (!existsSync(usersFile)) {
    writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

export function readUsers() {
  ensureFile();

  try {
    const parsed = JSON.parse(readFileSync(usersFile, 'utf8'));
    return Array.isArray(parsed?.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

/* نوشتن اتمیک: tmp → rename. اگر وسط نوشتن پروسه بمیرد، فایل اصلی سالم می‌ماند. */
function writeUsers(users) {
  ensureFile();
  const tmp = `${usersFile}.tmp`;
  writeFileSync(tmp, JSON.stringify({ users }, null, 2), 'utf8');
  renameSync(tmp, usersFile);
}

export function findUserByPhone(phone) {
  const normalizedPhone = normalizeDigits(phone);
  if (!normalizedPhone) return null;
  return readUsers().find((user) => user.phone === normalizedPhone) ?? null;
}

export function findUserById(id) {
  if (!id) return null;
  return readUsers().find((user) => user.id === id) ?? null;
}

/*
 * `googleId` شناسهٔ پایدار حساب گوگل است و `passwordHash` هش رمز؛ هیچ‌کدام نباید
 * از API بیرون بروند. `sanitizeUserForClient` نام صریح‌تر همان کار است.
 *
 * قاعده: Database User Object ≠ Public API User Object
 */
export function publicUser(user) {
  if (!user) return null;

  const { passwordHash, googleId, ...safeUser } = user;
  return safeUser;
}

export const sanitizeUserForClient = publicUser;

/* ────────────────────────── CREATE (ثبت‌نام) ────────────────────────── */

/*
 * فقط می‌سازد. اگر شماره از قبل وجود داشته باشد، **هیچ‌چیز** عوض نمی‌شود:
 * نه `passwordHash`، نه پروفایل، نه `createdAt` — و سشن هم بیرون از این تابع
 * ساخته نمی‌شود (چون خطا پرتاب می‌شود و `usersApi` به ۴۰۹ می‌رسد).
 */
export function createUser({ phone, password, profile }) {
  const normalizedPhone = normalizeDigits(phone);
  const phoneCheck = validatePhone(normalizedPhone);
  if (!phoneCheck.ok) throw authError(phoneCheck.code, phoneCheck.message);

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) throw authError(passwordCheck.code, passwordCheck.message);

  const users = readUsers();
  if (users.some((user) => user.phone === normalizedPhone)) {
    throw authError('USER_ALREADY_EXISTS', 'این شماره قبلاً ثبت شده است؛ وارد شوید.');
  }

  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    phone: normalizedPhone,
    passwordHash: hashPassword(password),
    passwordUpdatedAt: now,
    profile: { ...EMPTY_PROFILE, ...(profile ?? {}) },
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  writeUsers(users);

  return user;
}

/* ─────────────────────────── UPDATE (پروفایل) ────────────────────────── */

/*
 * فقط پروفایل. `passwordHash`، `id`، `phone` و `createdAt` دست‌نخورده می‌مانند و
 * هیچ راهی برای تغییر رمز از این مسیر وجود ندارد.
 */
export function updateUserProfileById(userId, profile) {
  if (!userId) throw authError('USER_NOT_FOUND', 'کاربر پیدا نشد.');

  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) throw authError('USER_NOT_FOUND', 'کاربر پیدا نشد.');

  const existing = users[index];
  const next = {
    ...existing,
    profile: { ...EMPTY_PROFILE, ...(existing.profile ?? {}), ...(profile ?? {}) },
    updatedAt: new Date().toISOString(),
  };

  users[index] = next;
  writeUsers(users);

  return next;
}

/* ارتقای هش پس از ورود موفق با فرمت قدیمی — فقط رو به جلو (legacy → scrypt) */
export function upgradePasswordHash(userId, newHash) {
  if (!userId || typeof newHash !== 'string' || !newHash) return false;

  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return false;
  if (users[index].passwordHash === newHash) return false;

  const now = new Date().toISOString();
  users[index] = { ...users[index], passwordHash: newHash, passwordUpdatedAt: now, updatedAt: now };
  writeUsers(users);

  return true;
}

/* ────────────────────────────── ورود ────────────────────────────── */

/*
 * هویت را از شماره پیدا می‌کند و رمز را می‌سنجد. در صورت موفقیت با هش قدیمی،
 * همان‌جا به scrypt ارتقا می‌دهد. خروجی `{ user, migrated }` است تا لایهٔ API
 * بتواند مهاجرت را گزارش/آزمون کند.
 */
export function verifyUserDetailed({ phone, password }) {
  const user = findUserByPhone(phone);
  if (!user) return null;

  /*
   * حساب‌های ساخته‌شده با گوگل رمز ندارند. بدون این گارد، شرط بعدی برای آن‌ها
   * هر رمزی را قبول می‌کرد (`null && …` ⇒ رد نمی‌شد) — یعنی یک راه ورود باز.
   */
  if (!user.passwordHash) return null;
  if (!verifyPasswordHash(password, user.passwordHash)) return null;

  const migrated = isLegacyPasswordHash(user.passwordHash)
    ? upgradePasswordHash(user.id, hashPassword(password))
    : false;

  return { user: migrated ? findUserById(user.id) ?? user : user, migrated };
}

/* شکل سازگار با مصرف‌کننده‌های قبلی: کاربر یا `null` */
export function verifyUser({ phone, password }) {
  return verifyUserDetailed({ phone, password })?.user ?? null;
}

/* ────────────────────────── حساب گوگل ────────────────────────── */

/*
 * ساخت/به‌روزرسانی حساب از پروفایل گوگل (`sub` + `email` + نام).
 *
 * حساب سایت با شمارهٔ موبایل هویت می‌گیرد؛ حساب گوگلی شماره ندارد، پس شناسه‌اش
 * `googleId` است. بدون کلید دوم، هر ورود یک حساب تازه می‌ساخت.
 *
 * اتصال به حساب موجود فقط با ایمیلِ **تأییدشدهٔ** گوگل انجام می‌شود؛ وگرنه
 * ایمیلِ تأییدنشدهٔ یک Workspace می‌توانست حساب دیگری را در اختیار بگیرد.
 *
 * این مسیر عمداً `passwordHash` را دست نمی‌زند: حساب گوگلی رمز ندارد و اگر
 * بعداً کاربر رمز بگذارد، همین مقدار حفظ می‌شود.
 */
export function saveGoogleUser(profile) {
  const googleId = String(profile?.sub ?? '').trim();
  if (!googleId) throw new Error('google-subject-required');

  const email = String(profile.email ?? '').trim().toLowerCase();
  const emailTrusted = profile.email_verified === true;
  const users = readUsers();
  const now = new Date().toISOString();

  let index = users.findIndex((user) => user.googleId === googleId);

  if (index === -1 && email && emailTrusted) {
    index = users.findIndex(
      (user) => String(user.email ?? '').toLowerCase() === email,
    );
  }

  const existing = index === -1 ? null : users[index];
  const previousProfile = existing?.profile ?? {};

  /*
   * پروفایل را اول کامل می‌سازیم و بعد جای خالی‌ها را پر می‌کنیم. اگر نام گوگل را
   * کنار همان کلیدهای `firstName`/`lastName` می‌نوشتیم، کلید تکراری می‌شد و
   * esbuild هشدار duplicate-object-key می‌داد.
   */
  const nextProfile = { ...EMPTY_PROFILE, ...previousProfile };

  /* نام گوگل فقط جای خالی را پر می‌کند؛ چیزی که کاربر خودش نوشته بازنویسی نمی‌شود */
  if (!nextProfile.firstName) nextProfile.firstName = String(profile.given_name ?? '').trim();
  if (!nextProfile.lastName) nextProfile.lastName = String(profile.family_name ?? '').trim();

  const nextUser = {
    id: existing?.id ?? randomUUID(),
    phone: existing?.phone ?? '',
    googleId,
    email: email || existing?.email || '',
    emailVerified: emailTrusted,
    passwordHash: existing?.passwordHash ?? null,
    profile: nextProfile,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (index === -1) {
    users.push(nextUser);
  } else {
    users[index] = nextUser;
  }

  writeUsers(users);

  return nextUser;
}

/* مسیر فایل — برای تست‌ها و ابزار نگهداری */
export const usersFilePath = usersFile;
