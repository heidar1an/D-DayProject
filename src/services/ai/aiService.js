/*
 * لایهٔ انتزاعی (Abstraction) هوش مصنوعی تپش.
 *
 * UI هیچ چیز دربارهٔ مدل پشت‌صحنه نمی‌داند؛ فردا می‌توان با تغییر یک خط (PROVIDER)
 * سرویس را به Claude، Gemini یا Backend داخلی تپش وصل کرد بدون اینکه یک خط
 * از کامپوننت‌ها عوض شود.
 *
 * قرارداد آیندهٔ Backend:
 *   POST /api/ai/chat              ← استریم SSE: هر event = تکّهٔ متن (delta)
 *   POST /api/ai/attachments       ← { id, name, type, size, url }
 *
 * امضای sendMessage:
 *   sendMessage({ text, attachments, mode, context, history, signal, onChunk })
 *     text        : متن کاربر
 *     attachments : [{ id, name, type, size, previewUrl }]
 *     mode        : 'general' | 'study' | 'medical' | 'quiz'
 *     context     : خروجی getAIContext() سرویس aiContext — آگاهی از صفحهٔ فعلی
 *     history     : پیام‌های قبلی [{ role, text }]
 *     signal      : AbortController.signal برای «توقف تولید»
 *     onChunk     : (fullTextSoFar) => void — هر تکه، متن تجمیعی کامل
 *
 * خطا: هر Promise رد شده یعنی شکست؛ UI فقط دو حالت «متن کامل» یا «خطا» می‌بیند.
 */

import * as mockProvider from './mockAI';

const PROVIDERS = {
  mock: mockProvider,
};

/* روزی که Backend آماده شد: PROVIDERS.real = realProvider و 'mock' → 'real' */
const ACTIVE_PROVIDER = 'mock';

const provider = () => PROVIDERS[ACTIVE_PROVIDER];

export function sendMessage(options) {
  return provider().sendMessage(options);
}

export function regenerateResponse(options) {
  return provider().regenerateResponse(options);
}

export function uploadAttachment(file) {
  return provider().uploadAttachment(file);
}
