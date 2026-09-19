/*
 * ورود و ثبت‌نام با گوگل — OAuth 2.0 «Authorization Code» بدون هیچ وابستگی بیرونی.
 *
 * چرا سمت سرور و نه در مرورگر: `client_secret` هرگز نباید به مرورگر برود و «کد»
 * یک‌بارمصرف گوگل باید در سرور با توکن معاوضه شود. مرورگر فقط دو کار می‌کند: به
 * `/start` می‌رود و «دست‌دادن» برگشتی را از `/handoff` می‌گیرد.
 *
 * قرارداد (همه GET):
 *   /api/auth/google/status    → { configured, redirectUri }
 *   /api/auth/google/start     → ۳۰۲ به گوگل (یا برگشت با `?google=unconfigured`)
 *   /api/auth/google/callback  → ۳۰۲ به سایت با
 *                                `?google=handoff|cancelled|state|failed|unconfigured`
 *   /api/auth/google/handoff   → { user }  — یک‌بارمصرف، از کوکی HttpOnly
 *
 * متغیرهای محیطی: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
 * آدرسی که باید در Google Console به‌عنوان Authorized redirect URI ثبت شود:
 * `<origin>/api/auth/google/callback` — خودِ سرور آن را در `status` می‌گوید.
 *
 * ⚠️ کوکی‌های این جریان `SameSite=Lax` هستند، نه `Strict` مثل کوکی نشست پنل:
 * بازگشت از `accounts.google.com` یک ناوبری «بین‌سایتیِ سطح‌بالا» است و کوکی
 * `Strict` در آن اصلاً فرستاده نمی‌شود ⇒ هر بار به خطای state می‌خوردیم.
 * `Secure` هم فقط وقتی گذاشته می‌شود که خودِ آدرس https باشد؛ وگرنه روی
 * `http://localhost` مرورگر کوکی را دور می‌ریزد و جریان بی‌صدا می‌شکند.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

import { findUserById, publicUser, saveGoogleUser } from './usersStore.js';
import { USER_SESSION_COOKIE, createUserSession } from './userSessions.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

const STATE_COOKIE = 'tapesh_google_state';
const HANDOFF_COOKIE = 'tapesh_google_handoff';

const STATE_MAX_AGE_S = 600; // ۱۰ دقیقه — فرصت کافی برای انتخاب حساب
const HANDOFF_MAX_AGE_S = 120; // ۲ دقیقه — فقط تا اولین fetch خودِ سایت

const DEFAULT_TIMEOUT_MS = 15_000;

/*
 * «دست‌دادن» یک توکن یک‌بارمصرف در حافظهٔ سرور است، نه دادهٔ کاربر در آدرس.
 * اگر سرور بین callback و handoff ری‌استارت شود، توکن باطل می‌شود و کاربر
 * دوباره تلاش می‌کند — پذیرفتنی، چون پنجره دو دقیقه است.
 */
const handoffs = new Map();

/* ═══ ابزارهای کوچک پاسخ ═══ */

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function redirect(response, location) {
  response.statusCode = 302;
  response.setHeader('Location', location);
  response.setHeader('Cache-Control', 'no-store');
  response.end();
}

function appendCookie(response, value) {
  const previous = response.getHeader('Set-Cookie');
  const list = previous ? [].concat(previous) : [];
  response.setHeader('Set-Cookie', [...list, value]);
}

function readCookie(request, name) {
  const header = String(request.headers?.cookie ?? '');
  const prefix = `${name}=`;

  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }

  return null;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/* ═══ پیکربندی و آدرس‌ها ═══ */

export function googleAuthConfig() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID ?? '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET ?? '').trim();

  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

/*
 * مبدأ (origin) سایت از خود درخواست درمی‌آید تا همان دامنه‌ای که کاربر روی آن
 * است برگردد. `PUBLIC_SITE_URL` مقدم است چون پشت پروکسی، هدر Host دامنهٔ داخلی
 * را می‌دهد و آدرس بازگشت باید دقیقاً همان چیزی باشد که در گوگل ثبت شده.
 */
function requestOrigin(request) {
  const base = String(process.env.PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (base) return base;

  const headers = request.headers ?? {};
  const host = String(headers['x-forwarded-host'] ?? headers.host ?? 'localhost:5173')
    .split(',')[0]
    .trim();
  const forwarded = String(headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);

  return `${forwarded || (isLocal ? 'http' : 'https')}://${host}`;
}

function googleRedirectUri(request) {
  return `${requestOrigin(request)}/api/auth/google/callback`;
}

function cookieSuffix(origin, maxAgeSeconds) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

/* ═══ گفت‌وگو با گوگل ═══ */

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`google-http-${response.status}: ${text.slice(0, 200)}`);
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGoogleProfile({ code, redirectUri, config }) {
  const token = await fetchJson(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!token?.access_token) throw new Error('google-access-token-missing');

  return fetchJson(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
}

/* ═══ دست‌دادن یک‌بارمصرف ═══ */

function pruneHandoffs() {
  const now = Date.now();

  for (const [token, entry] of handoffs) {
    if (entry.expiresAt <= now) handoffs.delete(token);
  }
}

function createHandoff(userId) {
  pruneHandoffs();

  const token = randomBytes(24).toString('hex');
  handoffs.set(token, { userId, expiresAt: Date.now() + HANDOFF_MAX_AGE_S * 1000 });
  return token;
}

function takeHandoff(token) {
  const entry = handoffs.get(token);
  if (!entry) return null;

  /* یک‌بارمصرف: حتی اگر منقضی شده باشد، دوباره قابل استفاده نیست */
  handoffs.delete(token);
  return entry.expiresAt > Date.now() ? entry : null;
}

/* ═══ گام‌های جریان ═══ */

function handleStatus(request, response) {
  const { configured } = googleAuthConfig();

  sendJson(response, 200, {
    configured,
    redirectUri: googleRedirectUri(request),
  });
}

function handleStart(request, response) {
  const origin = requestOrigin(request);
  const { configured, clientId } = googleAuthConfig();

  if (!configured) {
    redirect(response, `${origin}/?google=unconfigured#auth`);
    return;
  }

  const state = randomBytes(24).toString('hex');
  appendCookie(response, `${STATE_COOKIE}=${state}; ${cookieSuffix(origin, STATE_MAX_AGE_S)}`);

  const authorize = new URL(AUTH_ENDPOINT);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', googleRedirectUri(request));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  /* کاربر همیشه لیست حساب‌ها را ببیند تا «ورود» و «ثبت‌نام» با یک دکمه ممکن باشد */
  authorize.searchParams.set('prompt', 'select_account');

  redirect(response, authorize.toString());
}

async function handleCallback(request, response, url) {
  const origin = requestOrigin(request);
  const back = (code) => redirect(response, `${origin}/?google=${code}#auth`);

  if (!googleAuthConfig().configured) {
    back('unconfigured');
    return;
  }

  const denied = url.searchParams.get('error');
  if (denied) {
    back(denied === 'access_denied' ? 'cancelled' : 'failed');
    return;
  }

  /* گارد CSRF دوگانه: همان state باید هم در آدرس و هم در کوکی HttpOnly باشد */
  const state = url.searchParams.get('state') ?? '';
  const cookieState = readCookie(request, STATE_COOKIE) ?? '';
  response.setHeader('Set-Cookie', `${STATE_COOKIE}=; ${cookieSuffix(origin, 0)}`);

  if (!safeEqual(state, cookieState)) {
    back('state');
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    back('failed');
    return;
  }

  let profile;
  try {
    profile = await fetchGoogleProfile({
      code,
      redirectUri: googleRedirectUri(request),
      config: googleAuthConfig(),
    });
  } catch (error) {
    /* خطای واقعی گوگل در لاگ سرور می‌ماند، ولی به مرورگر فقط «نشد» می‌گوییم */
    console.error('[tapesh-google-auth]', error);
    back('failed');
    return;
  }

  if (!profile?.sub) {
    back('failed');
    return;
  }

  const user = saveGoogleUser(profile);
  appendCookie(
    response,
    `${HANDOFF_COOKIE}=${createHandoff(user.id)}; ${cookieSuffix(origin, HANDOFF_MAX_AGE_S)}`,
  );
  back('handoff');
}

function handleHandoff(request, response) {
  const origin = requestOrigin(request);
  const token = readCookie(request, HANDOFF_COOKIE) ?? '';
  appendCookie(response, `${HANDOFF_COOKIE}=; ${cookieSuffix(origin, 0)}`);

  const entry = token ? takeHandoff(token) : null;
  const user = entry ? findUserById(entry.userId) : null;

  /*
   * سشن سایت روی همین پاسخ صادر می‌شود: کوکی HttpOnly فایل‌پشتیبان. از این پس
   * هویت کاربر (از جمله Attemptهای آزمون) مرجع سروری دارد و localStorage فقط
   * نمایشی است. SameSite=Strict — fetchهای هم‌مبدأ آن را می‌فرستند.
   */
  if (user) {
    const session = createUserSession(user, {
      ip: request.socket?.remoteAddress ?? '',
      userAgent: request.headers?.['user-agent'] ?? '',
    });
    const secure = origin.startsWith('https://') ? '; Secure' : '';
    appendCookie(
      response,
      `${USER_SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${secure}`,
    );
  }

  sendJson(response, 200, { user: publicUser(user) });
}

/*
 * روتر. خروجی `true` یعنی درخواست مدیریت شد؛ `false` یعنی به لایهٔ بعد واگذار شود.
 * دقیقاً همان قرارداد `handleApi` در `adminApi.js` تا `server.js` و پلاگین ویت
 * بتوانند یک کد را صدا بزنند.
 */
export async function handleGoogleAuthApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (pathname !== '/api/auth/google' && !pathname.startsWith('/api/auth/google/')) {
    return false;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, {
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'متد پشتیبانی نمی‌شود' },
    });
    return true;
  }

  const action = pathname.slice('/api/auth/google'.length) || '/status';

  if (action === '/status') {
    handleStatus(request, response);
    return true;
  }

  if (action === '/start') {
    handleStart(request, response);
    return true;
  }

  if (action === '/callback') {
    await handleCallback(request, response, url);
    return true;
  }

  if (action === '/handoff') {
    handleHandoff(request, response);
    return true;
  }

  sendJson(response, 404, {
    success: false,
    error: { code: 'NOT_FOUND', message: 'مسیر پیدا نشد' },
  });
  return true;
}
