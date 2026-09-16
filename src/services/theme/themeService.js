/*
 * تم سایت — تنها منبع حقیقت برای حالت تیره/روشن.
 *
 * خودِ رنگ‌ها در src/styles.css تعریف شده‌اند (`:root[data-theme='light']`).
 * این سرویس فقط کلید تم را روی <html> می‌نشاند و در localStorage نگه می‌دارد،
 * پس هیچ لایه‌ای لازم نیست بداند تم چطور کار می‌کند.
 *
 * قرارداد:
 *   <html data-theme="light">  →  حالت روشن
 *   بدون data-theme            →  حالت تیره (پیش‌فرض و هویت پروژه)
 *
 * ⚠️ کلید localStorage عیناً در index.html هم استفاده می‌شود (اسکریپت ضد پرش تم
 *    که قبل از اولین رنگ‌آمیزی اجرا می‌شود). اگر عوضش کردی آن‌جا را هم عوض کن.
 */

export const THEME_KEY = 'tapesh:theme';
export const THEMES = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';

/* رنگ نوار مرورگر موبایل در هر تم — هم‌رنگ --background */
const THEME_COLORS = { dark: '#181818', light: '#f4f5f7' };

function normalize(value) {
  return THEMES.includes(value) ? value : null;
}

/* تم ذخیره‌شده؛ null یعنی کاربر هنوز انتخاب نکرده */
export function getStoredTheme() {
  if (typeof window === 'undefined') return null;

  try {
    return normalize(window.localStorage.getItem(THEME_KEY));
  } catch {
    /* حالت خصوصی مرورگر — تم فقط برای همین سشن می‌ماند */
    return null;
  }
}

/*
 * تم جاری از روی DOM خوانده می‌شود نه از state — تا با اسکریپت ضد پرش
 * و با تب‌های دیگر همیشه یکی بماند.
 */
export function getTheme() {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  return normalize(document.documentElement.getAttribute('data-theme')) || DEFAULT_THEME;
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  const next = normalize(theme) || DEFAULT_THEME;
  const root = document.documentElement;

  /* تم تیره پیش‌فرض است، پس اتریبیوت نمی‌نشیند — همان کاری که اسکریپت index.html می‌کند */
  if (next === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[next]);

  return next;
}

export function setTheme(theme) {
  const next = applyTheme(theme);

  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    /* نوشتن ممکن نشد؛ تم فقط تا پایان همین سشن می‌ماند */
  }

  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

/* هم‌گام‌سازی بین تب‌های باز همان سایت */
export function subscribeTheme(listener) {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event) => {
    if (event.key !== THEME_KEY) return;

    const next = applyTheme(normalize(event.newValue) || DEFAULT_THEME);
    listener(next);
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
