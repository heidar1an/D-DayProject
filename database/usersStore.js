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

export function publicUser(user) {
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
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
  if (user.passwordHash && user.passwordHash !== hashPassword(password)) return null;

  return user;
}
