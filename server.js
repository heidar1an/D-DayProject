/*
 * سرور پروداکشن تپش — بدون هیچ وابستگی بیرونی.
 *
 * چرا وجود دارد؟ چون middleware ویت فقط در حالت توسعه فعال است؛ در نسخهٔ Build
 * پنل مدیریت به API نیاز دارد. این سرور همان `handleApi` را سوار می‌کند و فایل‌های
 * `dist/` و `public/uploads/` را هم سرو می‌کند.
 *
 * اجرا:  npm run build  →  npm run start
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleApi } from './database/adminApi.js';
import { handleExamApi } from './database/examApi.js';
import { handleGoogleAuthApi } from './database/googleAuth.js';
import { handleUsersApi } from './database/usersApi.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(rootDir, 'dist');
const uploadsDir = resolve(rootDir, 'public', 'uploads');

/*
 * همان دلیل `vite.config.js`: نود خودش `.env` را نمی‌خواند، پس متغیرهای
 * سروری (از جمله GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) بدون این خط
 * هیچ‌وقت به `process.env` نمی‌رسند. باید **قبل** از خواندن PORT/HOST باشد.
 * پوسته مقدم است و اگر `.env` نبود، بی‌صدا رد می‌شویم.
 */
try {
  process.loadEnvFile(resolve(rootDir, '.env'));
} catch {
  /* .env نداریم */
}

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function isInside(parent, child) {
  const base = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(base);
}

function sendFile(response, filePath, status = 200) {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';

  response.statusCode = status;
  response.setHeader('Content-Type', type);
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (type.startsWith('image/') || type.startsWith('font/')) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (type.startsWith('text/html')) {
    response.setHeader('Cache-Control', 'no-cache');
  }

  createReadStream(filePath).pipe(response);
}

function tryServe(response, filePath) {
  if (!existsSync(filePath)) return false;
  if (!statSync(filePath).isFile()) return false;
  sendFile(response, filePath);
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const handled = await handleApi(request, response);
    if (handled) return;

    /* API آزمون‌های هماهنگ — سشن کوکی، Attempt سرورمحور، تصحیح فقط سرور */
    const handledExam = await handleExamApi(request, response);
    if (handledExam) return;

    /* ورود/ثبت‌نام با شماره — کوکی سشن کاربر سایت را صادر می‌کند */
    const handledUsers = await handleUsersApi(request, response);
    if (handledUsers) return;

    /* ورود/ثبت‌نام با گوگل — تنها API کاربری سایت که در پروداکشن لازم است */
    const handledGoogleAuth = await handleGoogleAuthApi(request, response);
    if (handledGoogleAuth) return;

    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.statusCode = 405;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'متد پشتیبانی نمی‌شود' } }));
      return;
    }

    /* فایل‌های آپلودی پنل */
    if (pathname.startsWith('/uploads/')) {
      const target = resolve(uploadsDir, `.${pathname.slice('/uploads'.length)}`);
      if (isInside(uploadsDir, target) && tryServe(response, target)) return;
    }

    /* دارایی‌های Build — مسیر حل‌شده باید داخل dist بماند (ضد path traversal) */
    const assetPath = resolve(distDir, `.${pathname}`);
    if (isInside(distDir, assetPath) && tryServe(response, assetPath)) return;

    /* SPA fallback: مسیرهای بدون پسوند به index.html */
    if (!extname(pathname)) {
      const indexPath = join(distDir, 'index.html');
      if (tryServe(response, indexPath)) return;
    }

    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('404 — پیدا نشد');
  } catch (error) {
    console.error('[tapesh-server]', error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    response.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'خطای سرور' } }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`تپش روی http://localhost:${PORT} بالا آمد — پنل مدیریت: /#admin`);

  const googleReady = Boolean(
    String(process.env.GOOGLE_CLIENT_ID ?? '').trim() &&
      String(process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
  );

  console.log(
    googleReady
      ? 'ورود با گوگل: فعال'
      : 'ورود با گوگل: غیرفعال — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET را در .env بگذارید',
  );
});
