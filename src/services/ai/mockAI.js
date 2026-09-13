/*
 * پیاده‌سازی Mock سرویس هوشمند تپش.
 * امضای توابع دقیقاً همان قرارداد aiService است؛ پاسخ به‌صورت استریم (تکه‌تکه) تحویل می‌شود
 * تا UI استریم واقعی را از همین امروز تجربه کند. با اتصال Backend، فقط این فایل عوض می‌شود.
 *
 * هوک تست: __mockAI.__setFailure(true) → همهٔ درخواست‌ها خطا می‌دهند (برای آزمودن Error State)
 */

import { ATTACHMENT_RESPONSE, pickResponse } from './mockResponses';

const THINKING_MS = 1100;
const TICK_MS = 28;
const MAX_CHUNK_TOKENS = 2;

let simulateFailure = false;

export function __setFailure(next) {
  simulateFailure = next;
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/* متن را به تکه‌های قابل استریم می‌شکند؛ فاصله‌ها حفظ می‌شوند تا Markdown سالم بماند */
function tokenize(text) {
  return text.match(/\s+|[^\s]+/g) ?? [text];
}

async function streamText(text, signal, onChunk) {
  const tokens = tokenize(text);
  let full = '';
  let i = 0;

  while (i < tokens.length) {
    await sleep(TICK_MS, signal);
    const chunk = tokens.slice(i, i + MAX_CHUNK_TOKENS).join('');
    full += chunk;
    i += MAX_CHUNK_TOKENS;
    onChunk?.(full);
  }

  return full;
}

function buildAnswer({ text, attachments }) {
  if (attachments?.length && !text.trim()) return ATTACHMENT_RESPONSE;
  return pickResponse(text);
}

/*
 * چت استریمی — در نسخهٔ واقعی: POST /api/ai/chat با پاسخ SSE یا ReadableStream.
 * onChunk هر بار «کل متن تا این لحظه» را می‌گیرد تا UI هیچ حالت تجمیعی نداشته باشد.
 */
export async function sendMessage({ text, attachments, mode, context, signal, onChunk }) {
  if (simulateFailure) {
    await sleep(THINKING_MS, signal);
    throw new Error('MOCK_AI_FAILURE');
  }

  await sleep(THINKING_MS, signal); /* شبیه‌سازی تأخیر اولین توکن مدل */

  const answer = buildAnswer({ text, attachments, mode, context });
  return streamText(answer, signal, onChunk);
}

/* بازتولید پاسخ — قرارداد مستقل دارد تا UI بدون شناخت تاریخچه بتواند صدا بزند */
export async function regenerateResponse({ text, attachments, mode, context, signal, onChunk }) {
  return sendMessage({ text, attachments, mode, context, signal, onChunk });
}

/* آپلود پیوست — در نسخهٔ واقعی: POST /api/ai/attachments → { id, url } */
export async function uploadAttachment(file) {
  await sleep(320);
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type: file.type || 'file',
    size: file.size,
    previewUrl: file.type?.startsWith('image/') ? URL.createObjectURL(file) : null,
  };
}

/* برای دیباگ از کنسول */
window.__mockAI = { __setFailure };
