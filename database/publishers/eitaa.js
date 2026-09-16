/*
 * آداپتور ایتا — پیام‌رسان داخلی با API ربات.
 *
 * ایتا (eitaayar.ir) همان قرارداد تلگرام را پیاده کرده است:
 *
 *   POST https://eitaayar.ir/api/{token}/{method}
 *   body: { chat_id, text }   →   { ok: true, result }  |  { ok: false, description }
 *
 * پس منطق مشترک در `telegramLike.js` است و اینجا فقط پیکربندی می‌آید.
 *
 * آدرس پایه از `EITAA_API_BASE` خوانده می‌شود تا اگر ایتا مسیر را عوض کرد،
 * فقط یک متغیر محیطی تغییر کند و هیچ کدی بازنویسی نشود.
 *
 * «تست اتصال» در پنل، دقیقاً همین قرارداد را روی سرور واقعی می‌آزماید؛ اگر
 * متدی پشتیبانی نشود، کاربر پیام روشن می‌بیند نه خطای مبهم.
 */

import { createTelegramLikeAdapter } from './telegramLike.js';

const adapter = createTelegramLikeAdapter({
  id: 'eitaa',
  label: 'ایتا',
  family: 'messenger',
  apiName: 'Eitaa Bot API',
  description: 'پیام‌رسان ایتا — ارسال با ربات و API رسمی ایتا (سازگار با تلگرام)',
  apiBaseEnv: 'EITAA_API_BASE',
  defaultApiBase: 'https://eitaayar.ir/api/',
  tokenEnv: 'EITAA_BOT_TOKEN',
  targetLabel: 'شناسهٔ کانال',
  targetHint: 'شناسهٔ عددی کانال ایتا یا یوزرنیم. ربات باید ادمین کانال باشد.',
  tokenLabel: 'توکن ربات ایتا',
  tokenHint: 'توکن ربات ساخته‌شده در پنل ربات‌های ایتا',
  docsUrl: 'https://eitaayar.ir',
  setupSteps: [
    'در ایتا یک ربات بساز (پنل ربات‌های ایتا) و توکن را بردار.',
    'کانال ایتا را باز کن → مدیریت → افزودن عضو → ربات را با دسترسی ارسال پست ادمین کن.',
    'شناسهٔ کانال را بردار؛ ساده‌ترین راه: عددی که در آدرس کانال می‌بینی.',
    'توکن و شناسه را همین‌جا بگذار و «تست اتصال» را بزن؛ نتیجه را خود ایتا می‌گوید.',
  ],
  supports: ['text', 'image', 'video', 'document'],
  contentTypes: ['post', 'video', 'announcement', 'poll'],
  metrics: ['followers'],
});

export const EITAA_PLATFORM = adapter.PLATFORM;
export const eitaaPlanMessages = adapter.plan;
export const summarizeEitaaPlan = adapter.summarize;
export const sendToEitaa = adapter.send;
export const eitaaMetrics = adapter.metrics;
export const verifyEitaa = adapter.verify;

export default adapter;
