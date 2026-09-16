/*
 * آداپتور ایتا — از طریق سرویس ایتایار (eitaayar.ir)، دروازهٔ API ایتا.
 *
 * ── چرا این فایل از `telegramLike.js` جدا شد؟ ──
 *
 * اول قرار بود ایتا هم روی همان هستهٔ مشترک بله/تلگرام بنشیند، چون ظاهر آدرس
 * یکی است:
 *
 *   POST https://eitaayar.ir/api/{token}/{method}   →   { ok, result }
 *
 * ولی مستندات رسمی ایتایار (`eitaayar.ir/assets/download/API_eitaayar.ir.pdf`
 * و `developer.eitaa.com`) و آزمون واقعی روی سرور نشان داد سه تفاوت مهم هست که
 * هستهٔ مشترک پوشش نمی‌دهد:
 *
 *   ۱) متد ارسال فایل `sendFile` است، نه `sendPhoto`/`sendDocument`، و نام
 *      پارامتر فایل `file` است (نه `photo`/`document`)؛ متن همراه فایل هم با
 *      `caption` می‌رود. آزمون واقعی: `sendDocument` → «method not found»،
 *      `sendFile` → «peer not found» (یعنی متد شناخته شده، فقط مقصد نبوده).
 *
 *   ۲) **هیچ متد خواندنی برای مقصد وجود ندارد.** `getChat`،
 *      `getChatMemberCount`، `getUpdates`، `getChannels` و `getChannel` همه
 *      «method not found» برمی‌گردانند. پس نمی‌شود از API پرسید «ربات به این
 *      کانال دسترسی دارد؟» یا «چند عضو دارد؟».
 *
 *   ۳) `disable_notification` عدد می‌خواهد (۱) نه مقدار بولی؛ و یک پارامتر
 *      اضافهٔ `title` دارد که در پنل ایتایار برای جست‌وجو و نمایش لیست پیام‌ها
 *      به کار می‌آید.
 *
 * ── نتیجهٔ این سه تفاوت در رفتار پنل ──
 *
 *   • «تست اتصال» فقط می‌تواند **توکن** را تأیید کند. بررسی مقصد با
 *     `ok: null` («بررسی‌نشده») برگردانده می‌شود تا هیچ‌وقت ادعای بررسی‌نشده
 *     نکنیم. دسترسی واقعی کانال با اولین ارسال معلوم می‌شود.
 *   • سنجهٔ دنبال‌کننده وجود ندارد ⇒ `metrics: []` و `metrics()` صادقانه
 *     `null` برمی‌گرداند، بدون هیچ درخواست شبکه‌ای. پنل به‌جای عدد ساختگی
 *     «داده‌ای نیست» نشان می‌دهد.
 *
 * ── قواعد ثابت (همان قواعد بقیهٔ آداپتورها) ──
 *
 *   • توکن هرگز لاگ نمی‌شود و هرگز در پاسخ برنمی‌گردد.
 *   • هر فراخوانی Timeout دارد؛ سرور بی‌پاسخ درخواست را قفل نمی‌کند.
 *   • خطاهای رایج به فارسی قابل‌فهم ترجمه می‌شوند.
 *   • هیچ وابستگی بیرونی؛ فقط `fetch`/`FormData`/`Blob` خودِ Node.
 *
 * آدرس پایه از `EITAA_API_BASE` خوانده می‌شود تا اگر ایتا مسیر را عوض کرد،
 * فقط یک متغیر محیطی تغییر کند و هیچ کدی بازنویسی نشود.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/* سقف متن همراه فایل (هم‌اندازهٔ بقیهٔ پیام‌رسان‌های این خانواده) */
const CAPTION_LIMIT = 1000;

/* این پلتفرم ۲ پیام در ثانیه به هر گفتگو اجازه می‌دهد */
const PAUSE_BETWEEN_MESSAGES_MS = 600;

const DEFAULT_API_BASE = 'https://eitaayar.ir/api';

const TOKEN_LABEL = 'توکن ایتایار';
const TARGET_LABEL = 'شناسهٔ کانال';

function timeoutMs() {
  const value = Number(process.env.PUBLISH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function apiBase() {
  return String(process.env.EITAA_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function platformError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/*
 * پیام خطای ایتایار دو جا می‌آید: `description` (کوتاه و انگلیسی) و `error`
 * (توضیح فارسی، گاهی همراه HTML). اول `description` ترجمه می‌شود؛ اگر نبود،
 * `error` از تگ پاک می‌شود. هیچ‌کدام هم که نبود، یک پیام عمومی.
 */
function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function friendlyDescription(payload, status) {
  const raw = String(payload?.description ?? '').trim();
  const haystack = raw.toLowerCase();

  if (status === 401 || haystack.includes('unauthorized')) {
    return 'توکن ایتایار نامعتبر است یا باطل شده؛ توکن را از پنل ایتایار دوباره بردار';
  }
  if (haystack.includes('method not found')) {
    return 'این متد در API ایتایار وجود ندارد؛ نسخهٔ API عوض شده است';
  }
  if (haystack.includes('chat not found') || haystack.includes('peer not found')) {
    return `شناسهٔ کانال پیدا نشد؛ شناسهٔ عددی پنل ایتایار → بخش کانال‌ها را بگذار (ارسال با یوزرنیم کار نمی‌کند)`;
  }
  /*
   * «user not access of channel chat» یک تلهٔ واقعی است: یوزرنیم کانال در ایتایار
   * *پیدا* می‌شود ولی ارسال با آن **مجاز نیست** — مجوز ارسال فقط به شناسهٔ عددی
   * همان کانال در پنل ایتایار گره خورده است. (آزمون واقعی: `chat_id=mytapesh` →
   * همین خطا، در حالی که `chat_id=11252784` با موفقیت ارسال می‌شود.)
   * پس پیام خطا باید کاربر را مستقیم به شناسهٔ عددی ببرد، نه به «یوزرنیم بدون @».
   */
  if (haystack.includes('user not access')) {
    return 'این شناسه اجازهٔ ارسال ندارد؛ شناسهٔ عددی کانال را از پنل ایتایار (بخش کانال‌ها) بردار — ارسال با یوزرنیم مجاز نیست';
  }
  if (haystack.includes('file invalid') || haystack.includes('file is too big')) {
    return 'فایل برای ارسال پذیرفته نشد؛ اندازه یا قالبش برای ایتا مناسب نیست';
  }
  if (status === 429 || haystack.includes('too many requests') || haystack.includes('retry after')) {
    return 'محدودیت نرخ ارسال؛ چند لحظه بعد دوباره تلاش کنید';
  }
  if (haystack.includes('not enough rights') || haystack.includes('forbidden') || status === 403) {
    return 'حساب ایتایار اجازهٔ ارسال به این کانال را ندارد';
  }

  return raw || stripHtml(payload?.error) || 'سرویس ایتایار درخواست را نپذیرفت';
}

function toBlob(media) {
  return new Blob([media.buffer], { type: media.mimeType || 'application/octet-stream' });
}

function sleep(ms) {
  return new Promise((resolvePromise) => { setTimeout(resolvePromise, ms); });
}

/* ───────────────────────── فراخوانی واحد API ───────────────────────── */

/*
 * `json` برای متدهای متنی و `form` برای آپلود فایل. هر دو را خود ایتایار
 * پشتیبانی می‌کند (مستندات: query string، json، urlencoded و multipart).
 */
async function callMethod(token, method, { json, form } = {}) {
  if (!token) throw platformError('توکن ایتایار تنظیم نشده است', 'PUBLISH_NO_TOKEN');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  let response;

  try {
    response = await fetch(`${apiBase()}/${token}/${method}`, {
      method: 'POST',
      signal: controller.signal,
      ...(form
        ? { body: form }
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw platformError(`پاسخ ایتایار در ${timeoutMs() / 1000} ثانیه نرسید`, 'PUBLISH_TIMEOUT');
    }
    throw platformError('ارتباط با سرور ایتایار برقرار نشد؛ اتصال شبکه را بررسی کنید', 'PUBLISH_UNREACHABLE');
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
    throw platformError(`پاسخ ایتایار قابل خواندن نبود (کد ${response.status})`, 'PUBLISH_FAILED', { httpStatus: response.status });
  }

  if (payload.ok === false || !response.ok) {
    const message = friendlyDescription(payload, response.status);
    /* ۴۰۳ کد «دسترسی» است نه «توکن باطل» — کد خطا هم باید همین را بگوید */
    const code = response.status === 401 ? 'PUBLISH_UNAUTHORIZED'
      : response.status === 403 ? 'PUBLISH_FORBIDDEN'
        : 'PUBLISH_FAILED';
    throw platformError(message, code, { httpStatus: response.status, platformCode: payload.error_code ?? null });
  }

  return payload.result ?? null;
}

/* ───────────────────────────── متدها ───────────────────────────── */

/* تنها متد خواندنی ایتایار — اطلاعات حساب صاحب توکن */
async function getMe(token) {
  const result = await callMethod(token, 'getMe');
  const name = [result?.first_name, result?.last_name].filter(Boolean).join(' ').trim();

  return {
    id: result?.id ?? null,
    username: result?.username ?? '',
    name: name || result?.username || '',
  };
}

/* ─────────────────────── شکستن محتوا به پیام‌ها ───────────────────────
 *
 * خالص و بدون شبکه؛ همان تابعی که پیش‌نمایش را می‌سازد، ارسال را هم می‌سازد.
 * پس «پیش‌نمایش = ارسال» یک قرارداد است، نه یک ادعا.
 */
function plan({ text, media }) {
  const body = String(text ?? '').trim();
  const steps = [];

  if (media) {
    const fitsInCaption = body.length > 0 && body.length <= CAPTION_LIMIT;
    steps.push({
      method: 'sendFile',
      label: fitsInCaption ? 'ارسال فایل با متن' : 'ارسال فایل',
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

function summarize(steps, target) {
  return {
    api: 'EitaaYar API',
    target,
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

/* ───────────────────────────── ارسال ───────────────────────────── */

async function send({ token, target, text, media, options = {} }) {
  const steps = plan({ text, media });
  if (!steps.length) throw platformError('متن پیام خالی است', 'VALIDATION_ERROR');

  /* عنوان فقط در پنل ایتایار دیده می‌شود و در جست‌وجوی پیام‌ها به کار می‌آید */
  const title = String(options.title ?? '').trim().slice(0, 120);
  const silent = Boolean(options.disableNotification);

  const sent = [];

  for (const step of steps) {
    if (sent.length) await sleep(PAUSE_BETWEEN_MESSAGES_MS);

    let result;

    if (step.method === 'sendMessage') {
      result = await callMethod(token, 'sendMessage', {
        json: {
          chat_id: target,
          text: step.text,
          ...(title ? { title } : {}),
          ...(silent ? { disable_notification: 1 } : {}),
        },
      });
    } else {
      const form = new FormData();
      form.append('chat_id', target);
      if (step.caption) form.append('caption', step.caption);
      if (title) form.append('title', title);
      if (silent) form.append('disable_notification', '1');
      form.append('file', toBlob(step.media), step.media.filename);

      result = await callMethod(token, 'sendFile', { form });
    }

    sent.push({ method: step.method, label: step.label, messageId: result?.message_id ?? null });
  }

  return { messages: sent, messageId: sent[0]?.messageId ?? null };
}

/* ───────────────────────── تست اعتبار ─────────────────────────
 *
 * دو بررسی، ولی فقط یکی قابل انجام است:
 *   توکن  → با `getMe` واقعاً بررسی می‌شود.
 *   مقصد  → `ok: null` می‌ماند، چون ایتایار متد خواندن کانال ندارد.
 *
 * یک بررسی سوم هم اینجاست که «بررسی شبکه» نیست ولی قطعی است: **شکل شناسه**.
 * ایتایار یوزرنیم کانال را پیدا می‌کند ولی ارسال با آن را مجاز نمی‌داند
 * (`403 Forbidden: user not access of channel chat`)، در حالی که شناسهٔ عددی
 * همان کانال بی‌مشکل می‌رود. پس اگر شناسه عددی نباشد، کاربر را همان‌جا و پیش از
 * ذخیره متوقف می‌کنیم — نه بعد از یک ارسال شکست‌خورده.
 *
 * `complete: true` یعنی «هر چیزی که قابل بررسی بود درست بود» — نه اینکه
 * دسترسی کانال تأیید شده. پنل همین را با رنگ هشدار (نه سبز) نشان می‌دهد.
 */
const NUMERIC_CHAT_ID = /^\d+$/;

async function verify({ token, target }) {
  const value = String(token ?? '').trim();
  const dest = String(target ?? '').trim();

  if (!value) {
    return {
      ok: false,
      complete: false,
      account: null,
      target: null,
      checks: [{ id: 'token', label: TOKEN_LABEL, ok: false, message: 'توکن را وارد کنید' }],
    };
  }

  const checks = [];
  let account = null;

  try {
    account = await getMe(value);
    checks.push({
      id: 'token',
      label: TOKEN_LABEL,
      ok: true,
      message: `حساب «${account.name || account.username || account.id}» شناسایی شد`,
    });
  } catch (error) {
    checks.push({ id: 'token', label: TOKEN_LABEL, ok: false, message: error?.message || 'توکن پذیرفته نشد' });
    return { ok: false, complete: false, account: null, target: null, checks };
  }

  if (!dest) {
    checks.push({
      id: 'target',
      label: `دسترسی به ${TARGET_LABEL}`,
      ok: null,
      message: `برای ارسال، ${TARGET_LABEL} لازم است؛ آن را وارد کنید`,
    });
    return { ok: true, complete: false, account, target: null, checks };
  }

  if (!NUMERIC_CHAT_ID.test(dest)) {
    checks.push({
      id: 'target',
      label: `دسترسی به ${TARGET_LABEL}`,
      ok: false,
      message: 'شناسه باید عددی باشد (مثل 11252784). ایتایار یوزرنیم کانال را پیدا می‌کند ولی ارسال با آن را مجاز نمی‌داند؛ شناسهٔ عددی را از پنل ایتایار → بخش کانال‌ها بردار.',
    });
    return { ok: true, complete: false, account, target: null, checks };
  }

  checks.push({
    id: 'target',
    label: `دسترسی به ${TARGET_LABEL}`,
    ok: null,
    message: 'ایتایار متد بررسی کانال (getChat) ندارد؛ اولین ارسال واقعی دسترسی را معلوم می‌کند',
  });

  return { ok: true, complete: true, account, target: null, checks };
}

/*
 * سنجهٔ دنبال‌کننده: ایتایار هیچ متدی برای شمارش اعضا ندارد، پس عدد ساخته
 * نمی‌شود و هیچ درخواست شبکه‌ای هم زده نمی‌شود.
 */
async function metrics() {
  return null;
}

/* درخواستی که در حالت آزمایشی «می‌رفت» — بدون هیچ شبکه‌ای و بدون توکن */
function previewRequest({ text, media, target, options = {} }) {
  return {
    endpoint: `${apiBase()}/{token}/{method}`,
    chatId: target,
    title: String(options.title ?? '').trim().slice(0, 120),
    disableNotification: Boolean(options.disableNotification),
    ...summarize(plan({ text, media }), target),
  };
}

/* ─────────────────────────── توصیف پلتفرم ─────────────────────────── */

const PLATFORM = {
  id: 'eitaa',
  label: 'ایتا',
  family: 'messenger',
  accent: '#e08a5b',
  apiKind: 'EitaaYar',
  description: 'پیام‌رسان ایتا — ارسال با توکن ایتایار (بدون متد بررسی کانال و بدون سنجه)',
  apiBaseEnv: 'EITAA_API_BASE',
  defaultApiBase: DEFAULT_API_BASE,
  tokenEnv: 'EITAA_BOT_TOKEN',
  targetLabel: TARGET_LABEL,
  targetHint: 'شناسهٔ عددی کانال از پنل ایتایار → بخش «کانال‌ها» (مثل 11252784). ارسال با یوزرنیم مجاز نیست.',
  tokenLabel: TOKEN_LABEL,
  tokenHint: 'توکنی که در پنل ایتایار → بخش API می‌گیری (شکل: bot123456:0000-1111-…)',
  docsUrl: 'https://developer.eitaa.com/docs/Develop/SendMassage/',
  setupUrl: 'https://eitaayar.ir/',
  setupUrlLabel: 'ورود به پنل ایتایار',
  supports: ['text', 'image', 'video', 'document'],
  contentTypes: ['post', 'video', 'announcement', 'poll'],
  /*
   * خالی بودن `metrics` عمدی است: ایتایار تعداد اعضای کانال را از API نمی‌دهد.
   * پنل از همین آرایه می‌فهمد که باید «داده‌ای نیست» نشان بدهد، نه صفر.
   */
  metrics: [],
  capabilities: {
    publish: true,
    metrics: false,
    comments: false,
    messages: false,
    sync: false,
    /* مقصد از API قابل بررسی نیست — پنل «بررسی‌نشده» را صادقانه نشان می‌دهد */
    verifyTarget: false,
  },
  setupSteps: [
    'در ایتا عضو سرویس ایتایار شو (eitaayar.ir) و با همان شمارهٔ ایتا وارد پنل شو.',
    'در پنل ایتایار → بخش API، توکن خودت را بردار. شکلش این است: bot123456:0000-1111-…',
    'کانال تپش را در پنل ایتایار → بخش «کانال‌ها» اضافه کن و اجازهٔ ارسالش را فعال کن.',
    'شناسهٔ عددی همان کانال را از بخش «کانال‌ها» بردار (مثل 11252784) و همین‌جا بگذار. ' +
      'یوزرنیم کانال کار نمی‌کند: ایتایار آن را پیدا می‌کند ولی مجوز ارسال فقط به شناسهٔ عددی گره خورده است.',
    'توکن و شناسه را همین‌جا بگذار و «تست اتصال» را بزن. ایتایار امکان بررسی کانال را از API نمی‌دهد، پس تأیید نهایی دسترسی با اولین «ارسال» واقعی معلوم می‌شود.',
  ],
};

const adapter = {
  PLATFORM,
  apiBase,
  getMe,
  plan,
  summarize,
  send,
  metrics,
  verify,
  previewRequest,
};

export const EITAA_PLATFORM = PLATFORM;
export const eitaaPlanMessages = plan;
export const summarizeEitaaPlan = summarize;
export const sendToEitaa = send;
export const eitaaMetrics = metrics;
export const verifyEitaa = verify;
export const previewEitaaRequest = previewRequest;

export default adapter;
