/*
 * بازخورد کاربر → سرور.
 *
 * تنها جایی که سایت گزارش کاربر را به سرور می‌فرستد. `source` اجباری است و
 * دقیقاً می‌گوید گزارش از کدام بخش تپش آمده؛ پنل مدیریت بر پایهٔ همین کلید، هر
 * منبع را در کادر جدا نشان می‌دهد.
 *
 * دو کار دیگر هم همین‌جا انجام می‌شود: خواندن پاسخ‌های مدیر برای لایهٔ
 * «اعلان‌ها»ی کاربر و علامت‌زدن‌شان به‌عنوان خوانده‌شده.
 */

import { getStoredUser } from '../userStorage';

/* شناسهٔ منابع — تنها جای تعریف این رشته‌ها */
export const FEEDBACK_SOURCES = {
  support: 'support',
  testBank: 'test-bank',
  coordinatedExam: 'coordinated-exam',
  comprehensive: 'comprehensive',
  micro: 'micro',
  questionLab: 'question-lab',
  intlCourses: 'intl-courses',
};

/* برچسب فارسی هر منبع — پنل و اعلان‌های کاربر از همین استفاده می‌کنند */
export const FEEDBACK_SOURCE_LABELS = {
  support: 'فرم راهنما و پشتیبانی',
  'test-bank': 'بانک تست علوم پایه',
  'coordinated-exam': 'آزمون‌های هماهنگ',
  comprehensive: 'درسنامه جامع',
  micro: 'میکرو درسنامه',
  'question-lab': 'آزمون‌های بین‌الملل',
  'intl-courses': 'دوره‌های بین‌الملل',
};

export function sourceLabel(source) {
  return FEEDBACK_SOURCE_LABELS[source] ?? source ?? 'نامشخص';
}

/*
 * هویت کاربر سایت.
 *
 * چرا از سمت کلاینت هم فرستاده می‌شود: نشست کاربر تپش در `localStorage` است
 * (`tapesh:current-user`) و کوکی سشن سروری همیشه وجود ندارد. سرور اگر سشن
 * واقعی داشت همان را مقدم می‌داند؛ وگرنه همین هویت را می‌گیرد تا نام و نام
 * کاربری در پنل خالی نماند.
 *
 * شناسه دقیقاً با قرارداد خودِ سایت ساخته می‌شود: `id ?? phone ?? username`
 * (همان چیزی که `trafficTracker` و همهٔ سرویس‌ها استفاده می‌کنند) تا یک کاربر
 * در همهٔ بخش‌ها **یک** شناسه داشته باشد؛ وگرنه پاسخ مدیر به گزارش او در
 * «اعلان‌ها» پیدا نمی‌شد.
 */
export function userRefOf(user) {
  if (!user || typeof user !== 'object') return null;

  const profile = user.profile ?? {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const id = user.id ?? user.phone ?? user.username ?? null;

  return {
    id: id == null ? null : String(id),
    name: fullName || user.name || profile.username || user.username || null,
    username: profile.username || user.username || null,
    phone: user.phone ?? null,
  };
}

/*
 * شناسهٔ پایدار مهمان.
 *
 * کاربرانِ وارد‌نشده هم باید بتوانند پاسخِ مدیر را در «اعلان‌ها» ببینند. بدون
 * یک شناسهٔ ثابت، گزارش مهمان با `userId: null` ثبت می‌شد و پاسخ مدیر هیچ‌وقت
 * به دست کسی نمی‌رسید. این شناسه فقط در مرورگر خودِ کاربر ساخته و نگه داشته
 * می‌شود و هیچ اطلاعات هویتی‌ای ندارد.
 */
const GUEST_KEY = 'tapesh:feedback-guest';

function guestRef() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `guest-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      window.localStorage.setItem(GUEST_KEY, id);
    }
    return { id, name: 'مهمان', username: null, phone: null };
  } catch {
    return null;
  }
}

export function currentUserRef() {
  try {
    return userRefOf(getStoredUser()) ?? guestRef();
  } catch {
    return null;
  }
}

/*
 * ارسال گزارش. شکست شبکه هرگز رابط کاربر را نمی‌شکند: در آن حالت `null`
 * برمی‌گردد و رکورد محلی (اگر لایه‌ای داشته باشد) سر جایش می‌ماند.
 *
 * `user` اختیاری است: لایه‌هایی که خودشان `userData` را در دست دارند می‌توانند
 * مستقیم بفرستند تا هویت حتی وقتی `localStorage` خوانده نمی‌شود هم دقیق باشد.
 */
export async function sendFeedback({ source, subject = '', category = '', message = '', meta = null, user = null }) {
  try {
    const identity = userRefOf(user) ?? currentUserRef();
    const response = await fetch('/api/public/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ source, subject, category, message, meta, user: identity }),
    });
    const payload = await response.json().catch(() => null);
    return payload?.success ? payload.data : null;
  } catch {
    return null;
  }
}

/* پاسخ‌های مدیر به گزارش‌های همین کاربر */
export async function fetchFeedbackReplies() {
  try {
    const user = currentUserRef();
    const query = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
    const response = await fetch(`/api/public/feedback/replies${query}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) return { items: [] };
    const payload = await response.json();
    return { items: payload?.data?.items ?? [] };
  } catch {
    return { items: [] };
  }
}

/* علامت‌زدن پاسخ‌ها به‌عنوان خوانده‌شده — بی‌صدا و بدون انتظار */
export function markFeedbackRepliesRead() {
  try {
    const user = currentUserRef();
    return fetch('/api/public/feedback/replies/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ userId: user?.id ?? null }),
    }).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/* «چند دقیقه پیش» برای ردیف‌های اعلان — بدون وابستگی بیرونی */
export function relativeFa(ts) {
  const diff = Math.max(0, Date.now() - Number(ts || 0));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFaDigits(days)} روز پیش`;
  return `${toFaDigits(Math.floor(days / 30))} ماه پیش`;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const toFaDigits = (value) => String(value ?? '').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
