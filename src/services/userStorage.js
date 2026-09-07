const SESSION_KEY = 'tapesh:current-user';
const LOCAL_USERS_KEY = 'tapesh:users';
const API_BASE = '/api/users';

export function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .trim();
}

function readLocalUsers() {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_USERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUser(user) {
  if (typeof window === 'undefined') return user;

  const users = readLocalUsers();
  const index = users.findIndex((item) => item.phone === user.phone);

  if (index === -1) {
    users.push(user);
  } else {
    users[index] = { ...users[index], ...user };
  }

  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  return user;
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function storeUser(user) {
  if (typeof window === 'undefined' || !user) return user;

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(SESSION_KEY);
}

export function getDisplayName(user) {
  if (!user) return '';

  const { firstName, lastName, username } = user.profile ?? {};
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || username || user.phone || '';
}

export async function saveUserRecord({ phone, password, profile }) {
  const normalizedPhone = normalizeDigits(phone);
  const localFallback = {
    id: `local-${normalizedPhone}`,
    phone: normalizedPhone,
    profile: {
      firstName: '',
      lastName: '',
      username: '',
      university: '',
      term: '',
      motivations: [],
      referralSources: [],
      ...(getStoredUser()?.profile ?? {}),
      ...(profile ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, password, profile }),
    });

    if (!response.ok) throw new Error('request-failed');

    const data = await response.json();
    writeLocalUser(data.user);
    return storeUser(data.user);
  } catch {
    writeLocalUser(localFallback);
    return storeUser(localFallback);
  }
}

export async function loginUser({ phone, password }) {
  const normalizedPhone = normalizeDigits(phone);

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, password }),
    });

    if (response.ok) {
      const data = await response.json();
      writeLocalUser(data.user);
      return storeUser(data.user);
    }

    if (response.status === 401) return null;
  } catch {
    // Falls through to the local fallback below (static build without API).
  }

  const localUser = readLocalUsers().find((user) => user.phone === normalizedPhone);
  return localUser ? storeUser(localUser) : null;
}
