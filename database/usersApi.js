/*
 * API کاربران سایت (`/api/users`) — هندلر مشترک.
 *
 * قبلاً فقط در پلاگین ویت (توسعه) سوار بود و در پروداکشن (`server.js`) وجود
 * نداشت؛ یعنی ورود/ثبت‌نام با شماره — و در نتیجه هویت سروری لازم برای آزمون —
 * در پروداکشن کار نمی‌کرد. حالا همین هندلر هم در `server.js` و هم در پلاگین
 * ویت استفاده می‌شود.
 *
 * روی register/login موفق، کوکی سشن HttpOnly فایل‌پشتیبان ست می‌شود
 * (`userSessions.js`) — هویت آزمون‌ها از همین کوکی می‌آید.
 */

import { findUserByPhone, publicUser, saveUser, verifyUser } from './usersStore.js';
import { USER_SESSION_COOKIE, createUserSession } from './userSessions.js';

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);

  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(body);
}

function readBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;

      if (raw.length > 1e6) {
        request.destroy();
        rejectPromise(new Error('payload-too-large'));
      }
    });
    request.on('end', () => {
      try {
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch {
        rejectPromise(new Error('invalid-json'));
      }
    });
    request.on('error', rejectPromise);
  });
}

/*
 * سشن سایت: کوکی HttpOnly فایل‌پشتیبان. شکل پاسخ endpointها عوض نمی‌شود
 * (همان `{user}` قبلی) — فقط هویت سروری کنار آن نشسته می‌شود.
 */
function setSessionCookie(response, user, request) {
  const session = createUserSession(user, {
    ip: request.socket?.remoteAddress ?? '',
    userAgent: request.headers?.['user-agent'] ?? '',
  });
  const secure = (request.headers?.['x-forwarded-proto'] ?? '') === 'https' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${USER_SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${secure}`,
  );
}

/*
 * خروجی `true` یعنی درخواست مدیریت شد؛ `false` یعنی به لایهٔ بعد واگذار شود —
 * همان قرارداد `handleApi`/`handleExamApi`.
 */
export async function handleUsersApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/users' && !url.pathname.startsWith('/api/users/')) return false;

  const path = url.pathname.replace(/\/$/, '').slice('/api/users'.length);

  try {
    if (request.method === 'GET' && (path === '' || path === '/lookup')) {
      const user = findUserByPhone(url.searchParams.get('phone'));
      sendJson(response, 200, { user: publicUser(user) });
      return true;
    }

    if (request.method === 'POST' && (path === '' || path === '/register')) {
      const payload = await readBody(request);
      const user = saveUser(payload);
      setSessionCookie(response, user, request);
      sendJson(response, 201, { user: publicUser(user) });
      return true;
    }

    if (request.method === 'POST' && path === '/login') {
      const payload = await readBody(request);
      const user = verifyUser(payload);

      if (!user) {
        sendJson(response, 401, { error: 'invalid-credentials' });
        return true;
      }

      setSessionCookie(response, user, request);
      sendJson(response, 200, { user: publicUser(user) });
      return true;
    }

    sendJson(response, 404, { error: 'not-found' });
    return true;
  } catch {
    /* پیام خطای واقعی سرور به بیرون درز نمی‌کند */
    sendJson(response, 400, { error: 'bad-request' });
    return true;
  }
}
