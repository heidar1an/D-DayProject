import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const usersFile = resolve(databaseDir, 'users.json');

function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

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

function writeUsers(users) {
  ensureFile();
  writeFileSync(usersFile, JSON.stringify({ users }, null, 2), 'utf8');
}

export function findUserByPhone(phone) {
  const normalizedPhone = normalizeDigits(phone);
  return readUsers().find((user) => user.phone === normalizedPhone) ?? null;
}

export function findUserById(id) {
  if (!id) return null;
  return readUsers().find((user) => user.id === id) ?? null;
}

/*
 * `googleId` شناسهٔ پایدار حساب گوگل است و هیچ‌جای کلاینت به آن نیازی ندارد؛
 * مثل `passwordHash` در سرور می‌ماند. (نشست سایت در localStorage مرورگر است.)
 */
export function publicUser(user) {
  if (!user) return null;

  const { passwordHash, googleId, ...safeUser } = user;
  return safeUser;
}

export function saveUser({ phone, password, profile }) {
  const normalizedPhone = normalizeDigits(phone);

  if (!normalizedPhone) {
    throw new Error('phone-required');
  }

  const users = readUsers();
  const now = new Date().toISOString();
  const index = users.findIndex((user) => user.phone === normalizedPhone);
  const existingUser = index === -1 ? null : users[index];

  const nextUser = {
    id: existingUser?.id ?? randomUUID(),
    phone: normalizedPhone,
    passwordHash: password ? hashPassword(password) : existingUser?.passwordHash ?? null,
    profile: {
      firstName: '',
      lastName: '',
      username: '',
      university: '',
      term: '',
      motivations: [],
      referralSources: [],
      ...(existingUser?.profile ?? {}),
      ...(profile ?? {}),
    },
    createdAt: existingUser?.createdAt ?? now,
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

export function verifyUser({ phone, password }) {
  const user = findUserByPhone(phone);

  if (!user) return null;

  /*
   * حساب‌های ساخته‌شده با گوگل رمز ندارند. بدون این گارد، شرط بعدی برای آن‌ها
   * هر رمزی را قبول می‌کرد (`null && …` ⇒ رد نمی‌شد) — یعنی یک راه ورود باز.
   */
  if (!user.passwordHash) return null;
  if (user.passwordHash !== hashPassword(password)) return null;

  return user;
}

/*
 * ساخت/به‌روزرسانی حساب از پروفایل گوگل (`sub` + `email` + نام).
 *
 * حساب سایت با شمارهٔ موبایل هویت می‌گیرد؛ حساب گوگلی شماره ندارد، پس شناسه‌اش
 * `googleId` است. بدون کلید دوم، هر ورود یک حساب تازه می‌ساخت.
 *
 * اتصال به حساب موجود فقط با ایمیلِ **تأییدشدهٔ** گوگل انجام می‌شود؛ وگرنه
 * ایمیلِ تأییدنشدهٔ یک Workspace می‌توانست حساب دیگری را در اختیار بگیرد.
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
  const nextProfile = {
    firstName: '',
    lastName: '',
    username: '',
    university: '',
    term: '',
    motivations: [],
    referralSources: [],
    ...previousProfile,
  };

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
