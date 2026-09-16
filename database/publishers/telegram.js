/*
 * آداپتور تلگرام — ربات از @BotFather، ارسال با Bot API.
 *
 * فقط پیکربندی است؛ منطق در `telegramLike.js` نوشته شده چون تلگرام، بله و ایتا
 * یک شکل API دارند.
 *
 * دو متد فراتر از ارسال، سنجهٔ واقعی می‌دهند:
 *   getChatMemberCount  → تعداد اعضای کانال = دنبال‌کنندهٔ واقعی
 *   getChat             → تأیید اینکه ربات واقعاً به کانال دسترسی دارد
 *
 * بازدید و تعامل را API ربات نمی‌دهد؛ آن‌ها در پنل «نیازمند اتصال» می‌مانند و
 * عدد ساختگی نمایش داده نمی‌شود.
 */

import { createTelegramLikeAdapter } from './telegramLike.js';

const adapter = createTelegramLikeAdapter({
  id: 'telegram',
  label: 'تلگرام',
  family: 'messenger',
  apiName: 'Telegram Bot API',
  description: 'پیام‌رسان تلگرام — ارسال با ربات BotFather و Bot API رسمی',
  apiBaseEnv: 'TELEGRAM_API_BASE',
  defaultApiBase: 'https://api.telegram.org/bot',
  tokenEnv: 'TELEGRAM_BOT_TOKEN',
  targetLabel: 'شناسهٔ کانال',
  targetHint: 'یوزرنیم عمومی (مثل @tapesh) یا شناسهٔ عددی منفی. ربات باید ادمین کانال باشد.',
  tokenLabel: 'توکن ربات تلگرام',
  tokenHint: 'از @BotFather در تلگرام بگیرید (شکل: ۱۲۳۴۵۶:ABC…)',
  docsUrl: 'https://core.telegram.org/bots/api',
  setupSteps: [
    'در تلگرام به @BotFather پیام بده → /newbot → نام و یوزرنیم → توکن را بگیر.',
    'کانال را باز کن → Manage Channel → Administrators → ربات را با اجازهٔ Post Messages ادمین کن.',
    'اگر کانال خصوصی است، شناسهٔ عددی منفی (شروع با -100) را بردار.',
    'توکن و شناسه را همین‌جا بگذار و «تست اتصال» را بزن؛ اگر سبز شد، ذخیره کن.',
  ],
  supports: ['text', 'image', 'video', 'document'],
  contentTypes: ['post', 'video', 'announcement', 'poll', 'thread'],
  metrics: ['followers'],
});

export const TELEGRAM_PLATFORM = adapter.PLATFORM;
export const telegramPlanMessages = adapter.plan;
export const summarizeTelegramPlan = adapter.summarize;
export const sendToTelegram = adapter.send;
export const telegramMetrics = adapter.metrics;
export const verifyTelegram = adapter.verify;
export const getTelegramMe = adapter.getMe;
export const getTelegramChat = adapter.getChat;

export default adapter;
