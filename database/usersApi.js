/*
 * API کاربران سایت (`/api/users`) — هندلر مشترک توسعه و پروداکشن.
 *
 * اصول این لایه (فاز Hardening احراز هویت):
 *
 *   • **هویت از سشن می‌آید، نه از ورودی کلاینت.** هیچ endpointای شمارهٔ تلفن را
 *     به‌عنوان کلید هویت نمی‌پذیرد. پروفایل فقط از `GET/PATCH /api/users/me`
 *     خوانده/نوشته می‌شود و سرور کاربر را از کوکی سشن تشخیص می‌دهد. endpoint
 *     قدیمی `GET /api/users?phone=…` (نشت پروفایل + user enumeration) حذف شد.
 *
 *   • **ثبت‌نام فقط می‌سازد، ورود فقط می‌سنجد.** register با شمارهٔ موجود ۴۰۹
 *     می‌دهد و هیچ‌چیز را بازنویسی نمی‌کند (بستن تصاحب حساب).
 *
 *   • **هر پاسخ از `publicUser` می‌گذرد** ⇒ نه `passwordHash` بیرون می‌رود، نه
 *     `googleId`، نه توکن سشن. توکن فقط داخل کوکی HttpOnly می‌نشیند.
 *
 *   • **خطای اعتبارنامه یکسان است.** «کاربر نیست» و «رمز غلط» هر دو
 *     ۴۰۱ `INVALID_CREDENTIALS` می‌گیرند تا enumeration ممکن نباشد.
 *
 *   • **Rate Limit** روی login و register (نگاه کنید به `userRateLimit.js`).
 *
 * Concurrency: `createUser` کاملاً همگام است و بین «خواندن فایل → بررسی تکراری
 * بودن → نوشتن» هیچ `await`ای ندارد؛ روی حلقهٔ تک‌رشته‌ای نود، دو درخواست
 * هم‌زمان نمی‌توانند هر دو از فیلتر رد شوند. تضمین «دقیقاً یک حساب» برای
 * استقرار چند-نودی به یک ذخیره‌گاه تراکنشی نیاز دارد (فاز Persistence) و
 * اینجا صادقانه مستند شده است — نه با workaround شکننده.
 */

import { randomBytes } from 'node:crypto';
import { USER_STATUS_BY_ERROR } from './apiContract/errorModel.js';
import {
  createUser,
  findUserById,
  publicUser,
  updateUserProfileById,
  verifyUserDetailed,
} from './usersStore.js';
import { USER_SESSION_COOKIE, createUserSession, destroyUserSession, getUserSession } from './userSessions.js';
import { consumeAuthAttempt } from './userRateLimit.js';
import { getUserHeartRewards, gradeTestBankAttempt, recordTestBankAnswers, transferGuestTestBankProgress } from './contentStore.js';

/* مدل خطای متمرکز (فاز ۷) — مقادیر عیناً همان جدول قبلی‌اند.
   ⚠ پوشش پاسخ این لایه با admin/exam یکی نیست (`{ error: code }` در ریشه)؛
   عمداً یکسان‌سازی نشد تا قرارداد فعلی کلاینت نشکند (بند ۱۹). */
const STATUS_BY_ERROR = USER_STATUS_BY_ERROR;

function httpError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);

  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);

  response.end(body);
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

      if (size > 1e6) {
        request.destroy();
        rejectPromise(httpError('PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      try {
        const parsed = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        resolvePromise(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        rejectPromise(httpError('BAD_REQUEST', 'بدنهٔ درخواست JSON معتبر نیست.'));
      }
    });
    request.on('error', () => rejectPromise(httpError('BAD_REQUEST')));
  });
}

function requireJsonBody(request) {
  if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
    throw httpError('UNSUPPORTED_MEDIA_TYPE', 'نوع محتوا باید application/json باشد.');
  }
}

/*
 * CSRF لایهٔ دوم: کوکی SameSite=Strict است و علاوه بر آن Origin باید با Host
 * یکی باشد. fetch بین‌دامنه‌ای نمی‌تواند این شرط را بسازد.
 */
function assertSameOrigin(request) {
  const origin = request.headers.origin;
  const host = String(request.headers['x-forwarded-host'] ?? request.headers.host ?? '')
    .split(',')[0]
    .trim();

  if (!origin || !host) throw httpError('FORBIDDEN');
  try {
    if (new URL(origin).host !== host) throw httpError('FORBIDDEN');
  } catch {
    throw httpError('FORBIDDEN');
  }
}

/* ───────────────────────────── ابزار سشن ───────────────────────────── */

/*
 * `Secure` روی کوکی سشن. سه سیگنال، هیچ‌کدام به‌تنهایی کافی نیست:
 *
 *   ۱. `request.socket.encrypted` — اتصال واقعاً TLS است (قابل جعل نیست).
 *   ۲. `NODE_ENV=production` — قاعدهٔ استاندارد پروژه (همان `examApi.js`)؛ با
 *      `TAPESH_INSECURE_COOKIE=1` برای پروداکشن روی http محلی خاموش می‌شود.
 *   ۳. `x-forwarded-proto: https` — پشت پروکسی TLS. قابل جعل است، ولی چون دو
 *      سیگنال قوی‌تر بالا هست، حذفش فقط پروداکشنِ پروکسی‌دارِ بدون NODE_ENV را
 *      بی‌`Secure` می‌کرد. (ضعف باقی‌مانده در گزارش فاز مستند شده است.)
 */
function isSecureCookieRequest(request) {
  if (request?.socket?.encrypted === true) return true;
  if (process.env.NODE_ENV === 'production' && process.env.TAPESH_INSECURE_COOKIE !== '1') return true;
  return String(request?.headers?.['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}

function secureCookieFlag(request) {
  return isSecureCookieRequest(request) ? '; Secure' : '';
}

function sessionTokenFromRequest(request) {
  return String(request.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${USER_SESSION_COOKIE}=`))?.slice(USER_SESSION_COOKIE.length + 1);
}

function sessionFromRequest(request) {
  return getUserSession(sessionTokenFromRequest(request));
}

function setSessionCookie(response, user, request) {
  const previousToken = sessionTokenFromRequest(request);
  const previous = getUserSession(previousToken);
  if (previous?.user.anonymous) transferGuestTestBankProgress(previous.user.id, user.id);

  const session = createUserSession(user, {
    ip: clientIp(request),
    userAgent: request.headers?.['user-agent'] ?? '',
  });

  /*
   * چرخش سشن (ضد session fixation): توکن قبلی همین مرورگر باطل می‌شود تا یک
   * توکنِ از قبل کاشته‌شده هرگز به سطح دسترسی حساب ارتقا پیدا نکند.
   * توکن دستگاه‌های دیگر دست‌نخورده می‌ماند (ورود این‌جا روی آن‌ها اثر ندارد).
   */
  if (previousToken) destroyUserSession(previousToken);

  response.setHeader(
    'Set-Cookie',
    `${USER_SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${secureCookieFlag(request)}`,
  );
}

function createGuestSession(response, request) {
  const guestTtlMs = 365 * 24 * 60 * 60 * 1000;
  const id = `guest-${randomBytes(16).toString('hex')}`;
  const session = createUserSession({ id }, {
    anonymous: true,
    ttlMs: guestTtlMs,
    ip: clientIp(request),
    userAgent: request.headers?.['user-agent'] ?? '',
  });
  response.setHeader(
    'Set-Cookie',
    `${USER_SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${guestTtlMs / 1000}${secureCookieFlag(request)}`,
  );
  return { user: { id, anonymous: true }, session };
}

/*
 * IP برای Rate Limit. آخرین هاپِ `x-forwarded-for` انتخاب می‌شود (نه اولین) چون
 * اولین مقدار را خود کلاینت می‌تواند جعل کند و یک پروکسی قابل‌اعتماد مقدار واقعی
 * را به انتها می‌افزاید. سطل IP کنترل *ثانویه* است؛ کنترل اصلی برای brute force
 * سطل «IP + شناسه» است که با جعل IP هم دور زدنش سود چندانی ندارد.
 */
function clientIp(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const hops = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return request.socket?.remoteAddress ?? '';
}

function rateLimitIdentity(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 20);
}

function enforceRateLimit(scope, request, identifier) {
  const result = consumeAuthAttempt(scope, { ip: clientIp(request), identifier });

  if (!result.allowed) {
    throw Object.assign(httpError('RATE_LIMITED', 'تلاش‌های بیش از حد؛ کمی بعد دوباره امتحان کنید.'), {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

/* ───────────────────────────── روتر ───────────────────────────── */

/*
 * خروجی `true` یعنی درخواست مدیریت شد؛ `false` یعنی به لایهٔ بعد واگذار شود —
 * همان قرارداد `handleApi`/`handleExamApi`.
 */
export async function handleUsersApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/users' && !url.pathname.startsWith('/api/users/')) return false;

  const path = url.pathname.replace(/\/$/, '').slice('/api/users'.length);
  const method = request.method;

  try {
    if (method === 'POST' && path === '/logout') {
      assertSameOrigin(request);
      destroyUserSession(sessionTokenFromRequest(request));
      response.setHeader('Set-Cookie', `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (method === 'GET' && path === '/hearts') {
      const session = sessionFromRequest(request);
      sendJson(response, 200, { awards: session ? getUserHeartRewards(session.user.id) : [] });
      return true;
    }

    if (method === 'POST' && path === '/test-bank/answers') {
      assertSameOrigin(request);
      requireJsonBody(request);
      enforceRateLimit('testBankAnswer', request, sessionFromRequest(request)?.user.id ?? '');
      const payload = await readBody(request);
      if (!Array.isArray(payload.answers)) throw httpError('BAD_REQUEST');

      const session = sessionFromRequest(request) ?? createGuestSession(response, request);
      /*
       * پاسخ‌ها فقط «واقعیت» هستند: کدام گزینه انتخاب شد. `isCorrect`، `reward`
       * یا هر فیلد نتیجه‌ای که کلاینت بفرستد نادیده گرفته می‌شود؛ درستی، پاداش و
       * `correctAnswer` را سرور تعیین می‌کند (بازگشایی کنترل‌شده پس از پاسخ).
       */
      const result = recordTestBankAnswers(session.user.id, payload.answers);
      sendJson(response, 200, { ok: true, ...result });
      return true;
    }

    /*
     * تصحیح authoritative یک تلاش آزمونک/آزمون شخصی بانک تست.
     * کلاینت نمره را نمی‌سازد؛ سرور با کلید خودش تصحیح می‌کند و همان شکل `result`
     * را برمی‌گرداند که UI از قبل می‌شناخت. کلید پاسخ در پاسخ این مسیر نمی‌آید —
     * بازگشایی از مسیر `/test-bank/answers` و پس از ثبت پاسخ انجام می‌شود.
     */
    if (method === 'POST' && path === '/test-bank/grade') {
      assertSameOrigin(request);
      requireJsonBody(request);
      enforceRateLimit('testBankGrade', request, sessionFromRequest(request)?.user.id ?? '');
      const payload = await readBody(request);
      if (!Array.isArray(payload.questionIds)) throw httpError('BAD_REQUEST');

      const result = gradeTestBankAttempt({
        questionIds: payload.questionIds,
        answers: payload.answers,
        negativeMarking: payload.negativeMarking,
      });
      sendJson(response, 200, { ok: true, result });
      return true;
    }

    /*
     * تنها منبع حقیقت احراز هویت کلاینت. سه حالت را از هم جدا می‌گوید:
     * ۲۰۰ (authenticated) · ۴۰۱ (unauthenticated) · خطای شبکه (کلاینت خودش).
     * سشن ناشناس (آزمونک مهمان) کاربر محسوب نمی‌شود.
     */
    if (method === 'GET' && path === '/me') {
      const session = sessionFromRequest(request);
      const user = session && !session.user.anonymous ? findUserById(session.user.id) : null;

      if (!user) {
        sendJson(response, 401, { authenticated: false, error: 'UNAUTHENTICATED' });
        return true;
      }

      sendJson(response, 200, { authenticated: true, user: publicUser(user) });
      return true;
    }

    if (method === 'PATCH' && path === '/me') {
      assertSameOrigin(request);
      requireJsonBody(request);

      const session = sessionFromRequest(request);
      const user = session && !session.user.anonymous ? findUserById(session.user.id) : null;
      if (!user) throw httpError('UNAUTHENTICATED', 'برای ویرایش پروفایل باید وارد شوید.');

      const payload = await readBody(request);
      const profile = payload?.profile;
      if (profile !== undefined && (typeof profile !== 'object' || profile === null || Array.isArray(profile))) {
        throw httpError('BAD_REQUEST');
      }

      const updated = updateUserProfileById(user.id, profile ?? {});
      sendJson(response, 200, { user: publicUser(updated) });
      return true;
    }

    if (method === 'POST' && path === '/register') {
      assertSameOrigin(request);
      requireJsonBody(request);

      const payload = await readBody(request);
      enforceRateLimit('register', request, rateLimitIdentity(payload.phone));

      /* createUser هم شماره و هم رمز را با `authPolicy` می‌سنجد؛ تکرار تکراری نیست */
      const user = createUser(payload);
      setSessionCookie(response, user, request);
      sendJson(response, 201, { user: publicUser(user) });
      return true;
    }

    if (method === 'POST' && path === '/login') {
      assertSameOrigin(request);
      requireJsonBody(request);

      const payload = await readBody(request);
      enforceRateLimit('login', request, rateLimitIdentity(payload.phone));

      const result = verifyUserDetailed(payload);
      if (!result) throw httpError('INVALID_CREDENTIALS', 'شماره تلفن یا رمز عبور نادرست است.');

      setSessionCookie(response, result.user, request);
      sendJson(response, 200, { user: publicUser(result.user) });
      return true;
    }

    /*
     * هیچ مسیر lookup عمومی وجود ندارد. `GET /api/users?phone=…` عمداً حذف شده
     * و اینجا هم ۴۰۴ می‌گیرد تا وجود/عدم وجود حساب قابل استخراج نباشد.
     */
    sendJson(response, 404, { error: 'NOT_FOUND' });
    return true;
  } catch (error) {
    const code = error?.code && STATUS_BY_ERROR[error.code] ? error.code : 'BAD_REQUEST';
    const status = STATUS_BY_ERROR[code];
    const headers = error?.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {};

    /* پیام خطای واقعی سرور به بیرون درز نمی‌کند؛ فقط کد و پیام کنترل‌شده */
    sendJson(
      response,
      status,
      { error: code, ...(code === 'BAD_REQUEST' ? {} : { message: error.message }) },
      headers,
    );
    return true;
  }
}
