/*
 * آداپتور بله — تنها جایی در پروژه که با API بله حرف می‌زند.
 *
 * بله API سازگار با API تلگرام دارد؛ ربات با BotFather بله (`@BotFather`) ساخته
 * می‌شود و توکن از همان‌جا می‌آید. شکل درخواست و پاسخ هم مثل تلگرام است:
 *
 *   POST {BALE_API_BASE}{token}/{method}
 *   موفق → { ok: true,  result: {...} }
 *   خطا  → { ok: false, error_code, description }
 *
 * برای فرستادن به کانال، `chat_id` کانال کافی است (متد جدا برای کانال وجود ندارد)
 * و ربات باید در آن کانال ادمین باشد.
 *
 * قواعد ثابت این آداپتور:
 *   - توکن هرگز لاگ نمی‌شود و هرگز در پاسخ برنمی‌گردد.
 *   - هر فراخوانی Timeout دارد؛ سرور بی‌پاسخ، درخواست را قفل نمی‌کند.
 *   - خطای بله به پیام فارسی قابل‌فهم ترجمه می‌شود (خطاهای رایج ربات/کانال).
 *   - هیچ وابستگی بیرونی ندارد؛ از `fetch`/`FormData`/`Blob` خودِ Node استفاده می‌کند.
 */

import { assertSafeApiBase } from './urlGuard.js';

const DEFAULT_API_BASE = 'https://tapi.bale.ai/bot';
const DEFAULT_TIMEOUT_MS = 15_000;

/* سقف متن همراه مدیا (هم‌قرارداد تلگرام) */
export const CAPTION_LIMIT = 1000;

/* بله اجازهٔ ۲ پیام در ثانیه به هر گفتگو می‌دهد؛ بین دو پیام پشت‌سرهم مکث می‌کنیم */
const PAUSE_BETWEEN_MESSAGES_MS = 600;

export const BALE_PLATFORM = {
  id: 'bale',
  label: 'بله',
  description: 'پیام‌رسان بله — API سازگار با تلگرام، ربات از BotFather بله',
  chatIdHint: 'شناسهٔ کانال؛ مثل @tapesh یا شناسهٔ عددی. ربات باید ادمین کانال باشد.',
  supports: ['text', 'image', 'document'],
  tokenLabel: 'توکن ربات بله',
  tokenHint: 'از @BotFather در بله بگیرید (شکل: ۱۲۳۴۵۶:ABC…)',
  tokenEnv: 'BALE_BOT_TOKEN',
  botFatherUrl: 'https://ble.ir/botfather',
  setupSteps: [
    'در بله به @BotFather پیام بده → New Bot → نام و یوزرنیم → توکن را بگیر.',
    'کانال را باز کن → مدیریت → اعضا → ربات را ادمین کن با دسترسی «ارسال پیام».',
    'شناسهٔ کانال را بردار: یوزرنیم عمومی (مثل @tapesh) یا شناسهٔ عددی.',
    'توکن و شناسه را همین‌جا بگذار و «تست اتصال» را بزن؛ اگر سبز شد، ذخیره کن.',
  ],
};

export function baleApiBase() {
  return assertSafeApiBase(String(process.env.BALE_API_BASE || DEFAULT_API_BASE), {
    envName: 'BALE_API_BASE',
    platform: 'بله',
  });
}

export function baleTimeoutMs() {
  const value = Number(process.env.PUBLISH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

/* توکن پیش‌فرض از env — فقط اگر روی کانال توکن اختصاصی تنظیم نشده باشد */
export function baleEnvToken() {
  return String(process.env.BALE_BOT_TOKEN || '').trim();
}

function publishError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/*
 * ترجمهٔ خطاهای رایج بله/تلگرام به پیام فارسی که کاربر بفهمد کجای کار میلنگد.
 * اگر الگویی نخورد، متن خود بله برگردانده می‌شود (بدون توکن).
 */
function friendlyDescription(raw, status) {
  const text = String(raw ?? '').trim();
  const haystack = text.toLowerCase();

  if (status === 429 || haystack.includes('too many requests') || haystack.includes('retry after')) {
    return 'محدودیت نرخ بله؛ چند لحظه بعد دوباره تلاش کنید';
  }
  if (haystack.includes('chat not found') || haystack.includes('peer_id_invalid')) {
    return 'کانال پیدا نشد؛ شناسهٔ کانال را بررسی کنید (مثل @tapesh یا شناسهٔ عددی)';
  }
  if (haystack.includes('bot was blocked') || haystack.includes('user is deactivated')) {
    return 'ربات توسط گیرنده مسدود شده است';
  }
  /*
   * «ربات عضو/ادمین نیست» باید پیش از بررسی توکن بیاید: بله و تلگرام برای کمبود
   * دسترسی هم کد ۴۰۳ می‌دهند — همان کدی که برای توکن باطل می‌دهند. اگر ۴۰۳
   * بی‌قید «توکن نامعتبر» ترجمه شود، کاربری که فقط باید ربات را ادمین کانال کند،
   * دنبال توکن تازه می‌رود.
   */
  if (
    haystack.includes('not a member')
    || haystack.includes('not enough rights')
    || haystack.includes('chat_admin_required')
    || haystack.includes('not enough permission')
    || haystack.includes('chat_write_forbidden')
    || haystack.includes('member list is inaccessible')
    || haystack.includes('forbidden')
  ) {
    return 'ربات در این کانال عضو یا ادمین نیست؛ آن را با اجازهٔ ارسال پست ادمین کنید';
  }
  if (status === 401 || haystack.includes('unauthorized') || haystack.includes('invalid token')) {
    return 'توکن ربات بله نامعتبر است یا باطل شده';
  }
  if (haystack.includes('wrong file identifier') || haystack.includes('file is too big')) {
    return 'فایل برای ارسال مناسب نیست یا حجمش بیش از حد مجاز بله است';
  }

  return text || 'بله درخواست را نپذیرفت';
}

function toBlob(media) {
  return new Blob([media.buffer], { type: media.mimeType || 'application/octet-stream' });
}

async function sleep(ms) {
  return new Promise((resolvePromise) => { setTimeout(resolvePromise, ms); });
}

/* ───────────────────────── فراخوانی خام متد بله ───────────────────────── */

async function callMethod(token, method, { json, form } = {}) {
  if (!token) throw publishError('توکن ربات بله تنظیم نشده است', 'PUBLISH_NO_TOKEN');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), baleTimeoutMs());
  let response;

  try {
    response = await fetch(`${baleApiBase()}${token}/${method}`, {
      method: 'POST',
      signal: controller.signal,
      ...(form
        ? { body: form }
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw publishError(`پاسخ بله در ${baleTimeoutMs() / 1000} ثانیه نرسید`, 'PUBLISH_TIMEOUT');
    }
    throw publishError('ارتباط با سرور بله برقرار نشد؛ اتصال شبکه یا فیلترشکن را بررسی کنید', 'PUBLISH_UNREACHABLE');
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== 'object') {
    throw publishError(`پاسخ بله قابل خواندن نبود (کد ${response.status})`, 'PUBLISH_FAILED', { httpStatus: response.status });
  }

  if (payload.ok === false) {
    const description = friendlyDescription(payload.description, response.status);
    /* ۴۰۳ کد «دسترسی» است نه «توکن باطل» — کد خطا هم باید همین را بگوید */
    const code = response.status === 401 ? 'PUBLISH_UNAUTHORIZED'
      : response.status === 403 ? 'PUBLISH_FORBIDDEN'
        : 'PUBLISH_FAILED';
    throw publishError(description, code, {
      httpStatus: response.status,
      platformCode: payload.error_code ?? null,
    });
  }

  if (!response.ok) {
    throw publishError(friendlyDescription(payload.description, response.status), 'PUBLISH_FAILED', {
      httpStatus: response.status,
      platformCode: payload.error_code ?? null,
    });
  }

  return payload.result ?? null;
}

/* ───────────────────────────── متدهای عمومی ───────────────────────────── */

/* تست اتصال و اعتبار توکن — نتیجه: { id, username, name } */
export async function getMe(token) {
  const result = await callMethod(token, 'getMe');
  return {
    id: result?.id ?? null,
    username: result?.username ?? '',
    name: result?.name ?? '',
  };
}

/*
 * اطلاعات یک کانال/گفتگو. مهم‌ترین کاربردش این است که **پیش از ذخیره** بفهمیم
 * ربات واقعاً به آن کانال دسترسی دارد: اگر ربات عضو یا ادمین نباشد، بله خطای
 * «chat not found» می‌دهد. یعنی همین متد، «ادمین‌بودن ربات» را هم تأیید می‌کند.
 */
export async function getChat(token, chatId) {
  const result = await callMethod(token, 'getChat', { json: { chat_id: chatId } });

  return {
    id: result?.id ?? null,
    type: result?.type ?? '',
    title: result?.title ?? result?.first_name ?? '',
    username: result?.username ?? '',
    memberCount: result?.member_count ?? null,
  };
}

export async function sendMessage(token, { chatId, text, disableNotification = false }) {
  return callMethod(token, 'sendMessage', {
    json: {
      chat_id: chatId,
      text,
      disable_notification: Boolean(disableNotification),
    },
  });
}

export async function sendPhoto(token, { chatId, media, caption = '', disableNotification = false }) {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  if (disableNotification) form.append('disable_notification', 'true');
  form.append('photo', toBlob(media), media.filename);

  return callMethod(token, 'sendPhoto', { form });
}

export async function sendDocument(token, { chatId, media, caption = '', disableNotification = false }) {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  if (disableNotification) form.append('disable_notification', 'true');
  form.append('document', toBlob(media), media.filename);

  return callMethod(token, 'sendDocument', { form });
}

/* ─────────────────────────── برنامهٔ ارسال ───────────────────────────
 *
 * یک محتوا ممکن است به یک یا دو پیام بشکند. قاعده:
 *   - مدیا + متن کوتاه  → یک پیام (مدیا با کپشن)
 *   - مدیا + متن بلند   → مدیا بی‌کپشن، بعد متن کامل (بدون تکرار متن)
 *   - فقط متن           → یک پیام متنی
 *
 * همین تابع هم پیش‌نمایش پنل را می‌سازد و هم ارسال واقعی را — پس آنچه کاربر
 * می‌بیند دقیقاً همان چیزی است که فرستاده می‌شود.
 */
export function planBaleMessages({ text, media }) {
  const body = String(text ?? '').trim();
  const steps = [];

  if (media) {
    const fitsInCaption = body.length > 0 && body.length <= CAPTION_LIMIT;
    steps.push({
      method: media.kind === 'image' ? 'sendPhoto' : 'sendDocument',
      label: media.kind === 'image' ? 'ارسال تصویر' : 'ارسال فایل',
      caption: fitsInCaption ? body : '',
      media,
    });
    if (body && !fitsInCaption) {
      steps.push({ method: 'sendMessage', label: 'ارسال متن کامل', text: body, media: null });
    }
  } else if (body) {
    steps.push({ method: 'sendMessage', label: 'ارسال متن', text: body, media: null });
  }

  return steps;
}

/* خلاصهٔ امن برنامه برای لاگ و پیش‌نمایش — بدون توکن، بدون محتوای کامل */
export function summarizePlan(steps, chatId) {
  return {
    chatId,
    steps: steps.map((step) => ({
      method: step.method,
      label: step.label,
      textLength: step.text ? step.text.length : (step.caption ?? '').length,
      hasMedia: Boolean(step.media),
      mediaFilename: step.media?.filename ?? null,
      mediaKind: step.media?.kind ?? null,
    })),
  };
}

/* ───────────────────────────── ارسال واقعی ───────────────────────────── */

export async function sendToBale({ token, chatId, text, media, disableNotification = false }) {
  const steps = planBaleMessages({ text, media });
  if (!steps.length) throw publishError('متن پیام خالی است', 'VALIDATION_ERROR');

  const sent = [];

  for (const step of steps) {
    if (sent.length) await sleep(PAUSE_BETWEEN_MESSAGES_MS);

    let result;
    if (step.method === 'sendMessage') {
      result = await sendMessage(token, { chatId, text: step.text, disableNotification });
    } else if (step.method === 'sendPhoto') {
      result = await sendPhoto(token, { chatId, media: step.media, caption: step.caption, disableNotification });
    } else {
      result = await sendDocument(token, { chatId, media: step.media, caption: step.caption, disableNotification });
    }

    sent.push({ method: step.method, label: step.label, messageId: result?.message_id ?? null });
  }

  return { messages: sent, messageId: sent[0]?.messageId ?? null };
}

/* آیا درخواست بدون شبکه هم قابل ساخت است؟ برای پیش‌نمایش در حالت آزمایشی */
export function previewBaleRequest({ text, media, chatId, disableNotification = false }) {
  const steps = planBaleMessages({ text, media });
  return {
    endpoint: `${baleApiBase()}<token>/<method>`,
    chatId,
    disableNotification: Boolean(disableNotification),
    ...summarizePlan(steps, chatId),
  };
}
