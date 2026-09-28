/*
 * لایهٔ ذخیره‌سازی ماژول برنامه‌ریزی.
 *
 * تنها جایی که به `localStorage` دست می‌زند همین فایل است؛ سرویس روی این لایه
 * می‌نشیند و UI هیچ‌وقت مستقیم سراغ حافظه نمی‌رود. برای وصل‌کردن API واقعی فقط
 * همین فایل عوض می‌شود (همان قرارداد `read`/`write` با Promise).
 *
 * چرا مرورگرِ بی‌حافظه هم پشتیبانی می‌شود: در حالت ناشناس یا وقتی کاربر ذخیره‌سازی
 * را بسته، `localStorage` استثنا می‌دهد. در آن حالت یک نقشهٔ درون‌حافظه‌ای جایگزین
 * می‌شود تا ماژول کار کند (فقط داده بین رفرش‌ها نمی‌ماند) و صفحه سفید نشود.
 */

/*
 * نسخهٔ پیشوند عمداً دو بار بالا رفته است (`v1` → `v2` → `v3`).
 *
 * نسخهٔ نخست با دادهٔ نمونهٔ ساختگی پر می‌شد و نسخهٔ دوم با فهرست دستی واحدها و
 * پروژه‌ها. با بالا بردن نسخه، هر کدام از آن‌ها که در مرورگر کاربران ذخیره شده
 * بود یک‌بار برای همیشه نادیده گرفته می‌شود و ماژول از صفر روی دادهٔ واقعی
 * پروژه بالا می‌آید — بدون مهاجرت و بدون باقی‌مانده.
 */
const PREFIX = 'tapesh.planning.v3.';

export const PLANNING_KEYS = {
  seeded: 'seeded',
  units: 'units',
  users: 'users',
  projects: 'projects',
  events: 'events',
  holidays: 'holidays',
  tasks: 'tasks',
  assignments: 'assignments',
  reminders: 'reminders',
  notifications: 'notifications',
  /* اعلان‌های خودکارِ «عقب‌افتاده» که کاربر خوانده‌شان اعلام کرده است */
  dismissed: 'dismissed',
  transactions: 'transactions',
  sops: 'sops',
  activity: 'activity',
  settings: 'settings',
};

const memory = new Map();
let usable = null;

function backend() {
  if (usable === null) {
    try {
      const probe = `${PREFIX}__probe`;
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      usable = true;
    } catch {
      usable = false;
    }
  }
  return usable;
}

export const storageAvailable = () => backend();

function rawGet(key) {
  const full = `${PREFIX}${key}`;
  if (!backend()) return memory.has(full) ? memory.get(full) : null;
  try {
    return window.localStorage.getItem(full);
  } catch {
    return null;
  }
}

function rawSet(key, value) {
  const full = `${PREFIX}${key}`;
  if (!backend()) {
    memory.set(full, value);
    return;
  }
  try {
    window.localStorage.setItem(full, value);
  } catch {
    /* سهمیه پر شده — به حافظهٔ موقت برمی‌گردیم تا عملیات کاربر شکست نخورد */
    memory.set(full, value);
  }
}

function rawRemove(key) {
  const full = `${PREFIX}${key}`;
  memory.delete(full);
  if (!backend()) return;
  try {
    window.localStorage.removeItem(full);
  } catch {
    /* بی‌اثر */
  }
}

/* ───────────────────────────── خواندن و نوشتن ───────────────────────────── */

export function read(key, fallback = null) {
  const value = rawGet(key);
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  rawSet(key, JSON.stringify(value));
  emit(key);
  return value;
}

export function remove(key) {
  rawRemove(key);
  emit(key);
}

export function readList(key) {
  const value = read(key, []);
  return Array.isArray(value) ? value : [];
}

/* پاک‌کردن کل دادهٔ ماژول (برای «بازنشانی داده‌های نمونه» در تنظیمات) */
export function clearAll() {
  Object.values(PLANNING_KEYS).forEach((key) => rawRemove(key));
  emit(null);
}

/* ───────────────────────────── رویداد تغییر ───────────────────────────── */

const listeners = new Set();

function emit(key) {
  listeners.forEach((listener) => {
    try {
      listener(key);
    } catch {
      /* شنوندهٔ خراب نباید نوشتن را متوقف کند */
    }
  });
}

/* اشتراک درون‌صفحه‌ای — بعد از هر نوشتن، نماها خودشان را تازه می‌کنند */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ───────────────────────────── کمکی‌ها ───────────────────────────── */

let counter = 0;

export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const nowISO = () => new Date().toISOString();

export function slugCode(prefix, index) {
  return `${prefix}-${String(1000 + index).slice(-4)}`;
}

/* حجم تقریبی دادهٔ ذخیره‌شده — برای نمایش در تنظیمات */
export function usageBytes() {
  let total = 0;
  Object.values(PLANNING_KEYS).forEach((key) => {
    const value = rawGet(key);
    if (typeof value === 'string') total += value.length;
  });
  return total * 2; /* UTF-16 */
}
