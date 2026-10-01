/*
 * API «آزمون‌های هماهنگ تپش» — الگوی همان `adminApi.js`.
 *
 * لایهٔ نازک روی examStore: احراز هویت سشن کوکی، Rate Limit، اعتبارسنجی ورودی،
 * پاکت پاسخ و خطا. هیچ تصمیم امنیتی‌ای به دادهٔ کلاینت تکیه نمی‌کند؛ نقش این
 * لایه فقط مرزبانی است.
 *
 * خطاها دو لایه دارند: `code` وضعیت HTTP-محور (CONFLICT/NOT_FOUND/…) و
 * `reason` کد بیزینسی (not-registered/time-over/…) که UI کلاینت روی آن تصمیم
 * نمایشی می‌گیرد. reason هرگز تصمیم امنیتی کلاینت را تغذیه نمی‌کند.
 *
 * CSRF: سشن کوکی SameSite=Strict است؛ لایهٔ دوم، الزام هدر سفارشی
 * `x-tapesh-exam` روی متدهای تغییردهنده — fetch بین‌دامنه‌ای بدون پاسخ
 * preflight نمی‌تواند هدر سفارشی بفرستد و این API به هیچ Originی CORS نمی‌دهد.
 */

import { randomBytes } from 'node:crypto';

import { EXAM_STATUS_BY_CODE } from './apiContract/errorModel.js';

import {
  USER_SESSION_COOKIE,
  createUserSession,
  getUserSession,
} from './userSessions.js';

import {
  cancelRegistrationFor,
  examBySlug,
  examDetailFor,
  fileQuestionReport,
  getActiveAttemptFor,
  getAttemptFor,
  listExamsFor,
  questionsForAttempt,
  rankingFor,
  recordAnswerDelta,
  registerFor,
  resultFor,
  reviewFor,
  saveAttemptProgressFor,
  startAttempt,
  submitAttemptFor,
  verifyAuditChain,
} from './examStore.js';

export const EXAM_CSRF_HEADER = 'x-tapesh-exam';

/* مدل خطای متمرکز (فاز ۷) — مقادیر عیناً همان جدول قبلی‌اند. */
const STATUS_BY_CODE = EXAM_STATUS_BY_CODE;

/* نگاشت خطای بیزینسی examStore → وضعیت HTTP و پیام فارسی */
const BUSINESS_ERRORS = {
  'exam-not-found': ['NOT_FOUND', 'آزمون پیدا نشد.'],
  'attempt-not-found': ['NOT_FOUND', 'Attempt آزمون پیدا نشد یا متعلق به شما نیست.'],
  'not-registered': ['CONFLICT', 'ثبت‌نام این آزمون بسته است.'],
  'exam-not-open': ['CONFLICT', 'آزمون در بازهٔ برگزاری نیست.'],
  'attempt-limit-reached': ['CONFLICT', 'سهمیهٔ شرکت در این آزمون پر شده است.'],
  'registration-closed': ['CONFLICT', 'ثبت‌نام این آزمون در بازهٔ مجاز نیست.'],
  'questions-not-published': ['CONFLICT', 'سؤال‌های این آزمون منتشر نشده است.'],
  'attempt-closed': ['CONFLICT', 'این Attempt پایان یافته است.'],
  'time-over': ['CONFLICT', 'زمان آزمون تمام شده است.'],
  'question-not-in-attempt': ['FORBIDDEN', 'این سؤال به Attempt شما تعلق ندارد.'],
  'invalid-answer': ['VALIDATION_ERROR', 'پاسخ ارسالی معتبر نیست.'],
  'invalid-payload': ['VALIDATION_ERROR', 'بدنهٔ درخواست معتبر نیست.'],
  'review-not-allowed': ['FORBIDDEN', 'مرور این آزمون مجاز نیست.'],
  'review-not-released': ['CONFLICT', 'کلید پاسخ هنوز منتشر نشده است.'],
  'question-required': ['VALIDATION_ERROR', 'شناسهٔ سؤال الزامی است.'],
  'reason-required': ['VALIDATION_ERROR', 'دلیل گزارش الزامی است.'],
};

const MAX_BODY_BYTES = 256 * 1024; /* بدنهٔ آزمون‌ها کوچک است؛ ۲۵۶ کیلوبایت کافی است */

function fail(code, message, reason) {
  throw Object.assign(new Error(message), { code, reason });
}

function failBusiness(businessCode) {
  const [code, message] = BUSINESS_ERRORS[businessCode] ?? ['CONFLICT', businessCode];
  fail(code, message, businessCode);
}

/* ───────────────────────────── ابزار HTTP ───────────────────────────── */

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(body);
}

function ok(response, data, status = 200) {
  sendJson(response, status, { success: true, data });
}

function sendError(response, error) {
  const code = error?.code && STATUS_BY_CODE[error.code] ? error.code : 'INTERNAL_ERROR';

  if (code === 'INTERNAL_ERROR') {
    /* جزئیات خطا فقط در کنسول سرور — پیام عمومی به بیرون */
    console.error('[tapesh-exam]', error);
  }

  sendJson(response, STATUS_BY_CODE[code], {
    success: false,
    error: {
      code,
      ...(error?.reason ? { reason: error.reason } : {}),
      message: code === 'INTERNAL_ERROR' ? 'خطای غیرمنتظره در سرور' : error.message,
    },
  });
}

/* مثل `adminApi.readBody`: بایت‌ها جمع می‌شوند و یک‌جا رمزگشایی می‌شوند تا نویسهٔ
   چندبایتی فارسی که وسط دو بستهٔ شبکه می‌افتد به U+FFFD تبدیل نشود. */
function readBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;

    request.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        request.destroy();
        rejectPromise(Object.assign(new Error('حجم درخواست بیش از حد مجاز است'), { code: 'PAYLOAD_TOO_LARGE' }));
        return;
      }
      chunks.push(buffer);
    });

    request.on('end', () => {
      if (!chunks.length) return resolvePromise({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(raw);
        resolvePromise(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        rejectPromise(Object.assign(new Error('بدنهٔ درخواست JSON معتبر نیست'), { code: 'VALIDATION_ERROR' }));
      }
    });

    request.on('error', () => {
      rejectPromise(Object.assign(new Error('خطا در خواندن درخواست'), { code: 'VALIDATION_ERROR' }));
    });
  });
}

function parseCookies(request) {
  const header = request.headers?.cookie ?? '';
  const jar = {};

  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) jar[key] = decodeURIComponent(value);
  });

  return jar;
}

function clientIp(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress ?? '';
}

function userCookieHeader(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' && process.env.TAPESH_INSECURE_COOKIE !== '1';
  return [
    `${USER_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function matchRoute(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[index]);
      continue;
    }
    if (part !== pathParts[index]) return null;
  }

  return params;
}

/* ───────────────────────────── Rate Limit ───────────────────────────── */

/*
 * پنجرهٔ ثابت درون-پروسسی — متناسب با تک‌پروسسه بودن فعلی سرور. برای استقرار
 * چند-نودی باید limit توزیع‌شده جایگزین شود (محدودیت مستندشده در سند امنیتی).
 */
const RATE_BUCKETS = new Map();
const RATE_WINDOW_MS = 60000;

function allowRate(key, limit, now = Date.now()) {
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket || bucket.windowStart + RATE_WINDOW_MS <= now) {
    RATE_BUCKETS.set(key, { windowStart: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/* پاک‌سازی گاه‌به‌گاه باکت‌ها تا Map رشد نکند */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of RATE_BUCKETS) {
    if (bucket.windowStart + RATE_WINDOW_MS * 2 <= now) RATE_BUCKETS.delete(key);
  }
}, 120000).unref?.();

/* ───────────────────────────── هویت ───────────────────────────── */

function resolveIdentity(request) {
  const token = parseCookies(request)[USER_SESSION_COOKIE];
  const found = getUserSession(token);
  if (!found) return null;
  return found.user; /* {id, anonymous?} */
}

function requireIdentity(request) {
  const identity = resolveIdentity(request);
  if (!identity) fail('UNAUTHENTICATED', 'برای این عملیات باید وارد حساب کاربری شوید.');
  return identity;
}

/*
 * سشن ناشناس فقط برای آزمونکِ همیشه‌در‌دسترس (نوع quiz) صادر می‌شود — خط‌مشی
 * صریح: آزمون‌های جدی همیشه به هویت واقعی گره می‌خورند.
 */
function identityForAttempt(request, exam) {
  const existing = resolveIdentity(request);
  if (existing) return existing;
  if (exam?.type === 'quiz' && exam?.alwaysAvailable) {
    const anonId = `anon-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
    const session = createUserSession(
      { id: anonId },
      { ip: clientIp(request), userAgent: request.headers?.['user-agent'] ?? '', anonymous: true },
    );
    request.__examSetCookie = userCookieHeader(session.token, 7 * 24 * 60 * 60);
    return { id: anonId, anonymous: true };
  }
  fail('UNAUTHENTICATED', 'برای شرکت در آزمون باید وارد حساب کاربری شوید.');
}

/* ───────────────────────────── مسیرها ───────────────────────────── */

/* [method, pattern, session(true|false|'anon-ok'), [rateKey, limit], handler] */
const ROUTES = [
  ['GET', '/api/exams/server-time', false, ['server-time', 240], async () => ({ serverTime: Date.now() })],

  ['GET', '/api/exams', false, ['exams-list', 120], async (ctx) => ({
    exams: listExamsFor(ctx.identity, ctx.now),
  })],

  ['GET', '/api/exams/:slug', false, ['exam-detail', 120], async (ctx) => {
    const detail = examDetailFor(ctx.identity, ctx.params.slug, ctx.now);
    if (!detail) failBusiness('exam-not-found');
    return detail;
  }],

  ['POST', '/api/exams/:slug/registration', true, ['registration', 30], async (ctx) => {
    const result = registerFor(ctx.identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['DELETE', '/api/exams/:slug/registration', true, ['registration', 30], async (ctx) => {
    const result = cancelRegistrationFor(ctx.identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  /* مهمان فقط برای آزمونک سشن ناشناس می‌گیرد؛ بقیه هویت واقعی می‌خواهند */
  ['POST', '/api/exams/:slug/attempts', 'anon-ok', ['attempt-start', 12], async (ctx) => {
    const identity = identityForAttempt(ctx.request, ctx.exam);
    const result = startAttempt(identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['GET', '/api/attempts/active', true, ['attempt-read', 120], async (ctx) => (
    getActiveAttemptFor(ctx.identity, ctx.now)
  )],

  ['GET', '/api/attempts/:id', true, ['attempt-read', 120], async (ctx) => {
    const result = getAttemptFor(ctx.identity, ctx.params.id, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['GET', '/api/attempts/:id/questions', true, ['attempt-questions', 90], async (ctx) => {
    const result = questionsForAttempt(ctx.identity, ctx.params.id, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['PUT', '/api/attempts/:id/answers', true, ['attempt-answer', 240], async (ctx) => {
    const result = recordAnswerDelta(ctx.identity, ctx.params.id, ctx.body?.answers, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['PUT', '/api/attempts/:id/progress', true, ['attempt-progress', 240], async (ctx) => {
    const result = saveAttemptProgressFor(ctx.identity, ctx.params.id, ctx.body ?? {}, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['POST', '/api/attempts/:id/submit', true, ['attempt-submit', 20], async (ctx) => {
    const reason = typeof ctx.body?.reason === 'string' ? ctx.body.reason : 'user';
    const result = submitAttemptFor(ctx.identity, ctx.params.id, { reason }, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['GET', '/api/exams/:slug/result', true, ['result-read', 120], async (ctx) => {
    const result = resultFor(ctx.identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['GET', '/api/exams/:slug/questions/review', true, ['review-read', 120], async (ctx) => {
    const result = reviewFor(ctx.identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['GET', '/api/exams/:slug/ranking', false, ['ranking-read', 120], async (ctx) => {
    const result = rankingFor(ctx.identity, ctx.params.slug, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],

  ['POST', '/api/questions/:id/report', true, ['question-report', 20], async (ctx) => {
    const result = fileQuestionReport(ctx.identity, ctx.params.id, ctx.body ?? {}, ctx.now);
    if (result.error) failBusiness(result.error);
    return result;
  }],
];

/* ───────────────────────────── هندلر اصلی ───────────────────────────── */

export async function handleExamApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  for (const [method, pattern, sessionRequired, [rateKey, rateLimit], handler] of ROUTES) {
    if (request.method !== method) continue;
    const params = matchRoute(pathname, pattern);
    if (!params) continue;

    try {
      const mutating = method !== 'GET' && method !== 'HEAD';
      if (mutating && !request.headers?.[EXAM_CSRF_HEADER]) {
        fail('FORBIDDEN', 'درخواست بدون هدر امنیتی پذیرفته نمی‌شود.');
      }

      const identity = sessionRequired === true ? requireIdentity(request) : resolveIdentity(request);
      const rateIdentity = identity?.id ?? `ip:${clientIp(request)}`;
      if (!allowRate(`${rateKey}:${rateIdentity}`, rateLimit)) {
        fail('RATE_LIMITED', 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.');
      }

      const ctx = {
        request,
        response,
        params,
        query: url.searchParams,
        body: mutating ? await readBody(request) : {},
        identity,
        now: Date.now(),
        exam: pattern === '/api/exams/:slug/attempts' ? examBySlug(params.slug) : undefined,
      };

      const data = await handler(ctx);
      if (request.__examSetCookie) {
        response.setHeader('Set-Cookie', request.__examSetCookie);
      }
      ok(response, data);
      return true;
    } catch (error) {
      if (!response.headersSent) sendError(response, error);
      return true;
    }
  }

  return false; /* مسیر ما نبود — واگذار به هندلر بعدی */
}

/* ابزار عملیاتی — صحت زنجیرهٔ حسابرسی */
export function examAuditStatus() {
  return verifyAuditChain();
}
