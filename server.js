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
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleApi } from './database/adminApi.js';
import { handleExamApi } from './database/examApi.js';
import { handleGoogleAuthApi } from './database/googleAuth.js';
import { handleUsersApi } from './database/usersApi.js';
import { serveUploadRequest } from './database/uploadsFile.js';
import { applySecurityHeaders, inlineScriptHashes } from './database/securityHeaders.js';
import { assertAdminCredentialUsable, isProduction } from './database/adminCredentialPolicy.js';
import { injectBaselineMeta, siteUrlFromEnv } from './database/seo.js';
import {
  accessLogEnabled,
  accessLogLine,
  checkReadiness,
  runtimeMetrics,
  isMetricsAuthorized,
  metricsTokenFromEnv,
  newRequestId,
} from './database/observability.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(rootDir, 'dist');
const dataDir = resolve(rootDir, 'database');

/*
 * مشاهده‌پذیری (فاز ۱۰ پیشنهادی).
 *
 *   • لاگ دسترسی پیش‌فرض روشن است — چون شکاف ممیزی همین بود: درخواست‌های خواندن
 *     هیچ‌جا ثبت نمی‌شدند. با `TAPESH_ACCESS_LOG=0` خاموش می‌شود.
 *   • متریک درون-حافظه است (همان محدودیتِ ثبت‌شدهٔ rate limit و نشست‌ها): با چند
 *     پروسه، هر پروسه سهم خودش را می‌بیند. برای تجمیع واقعی به ذخیره‌گاه مشترک
 *     نیاز است؛ اینجا ادعای بیشتر از این نمی‌شود.
 *   • `/metrics` فقط با `TAPESH_METRICS_TOKEN` وجود دارد. بدون توکن، مسیر ۴۰۴
 *     می‌دهد تا وجودش هم لو نرود.
 */
const metrics = runtimeMetrics;
const accessLogOn = accessLogEnabled();
const metricsToken = metricsTokenFromEnv();

/*
 * هدرهای امنیتی (فاز ۸).
 *
 * هش اسکریپت inline از **همان فایل HTMLی** محاسبه می‌شود که سرو می‌شود؛ پس اگر
 * متن اسکریپت ضد‌پرش تم عوض شود، CSP خودکار هم‌گام می‌شود و نمی‌شکند.
 */
const DEV = !isProduction();
const indexHtmlPath = join(distDir, 'index.html');
let inlineHashes = [];
let indexHtmlCache = null;
try {
  indexHtmlCache = readFileSync(indexHtmlPath, 'utf8');
  inlineHashes = inlineScriptHashes(indexHtmlCache);
} catch {
  /* dist هنوز ساخته نشده — CSP بدون هش اسکریپت inline اجرا می‌شود (dev) */
}

const SITE_URL = siteUrlFromEnv();
const SECURITY_OPTIONS = { dev: DEV, scriptHashes: inlineHashes, hsts: true };

/** صفحهٔ SPA با متای تزریق‌شده (canonical / og / JSON-LD). */
function serveIndexHtml(response, request) {
  const html = injectBaselineMeta(indexHtmlCache ?? '<!doctype html><html lang="fa" dir="rtl"><head></head><body><div id="root"></div></body></html>', {
    siteUrl: SITE_URL,
  });
  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Content-Length', String(Buffer.byteLength(html)));
  if (request?.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(html);
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

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
  /* ویدیو و زیرنویس دوره‌های بین‌الملل (آپلود پنل در `public/uploads/intl/`) */
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8',
};

function isInside(parent, child) {
  const base = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(base);
}

function sendFile(response, filePath, status = 200, request = null) {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const size = statSync(filePath).size;

  response.statusCode = status;
  response.setHeader('Content-Type', type);
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (type.startsWith('image/') || type.startsWith('font/')) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (type.startsWith('text/html')) {
    response.setHeader('Cache-Control', 'no-cache');
  }

  /*
   * پشتیبانی Range برای ویدیو.
   *
   * بدون این، مرورگر کل فایل را از ابتدا می‌گیرد و «جابه‌جایی در تایم‌لاین»
   * کار نمی‌کند (سافاری حتی پخش را شروع نمی‌کند). فقط یک بازه را می‌پذیریم؛
   * چندبازه‌ای (`multipart/byteranges`) لازم نیست.
   */
  const range = type.startsWith('video/') ? request?.headers?.range : null;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;

  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

    if (Number.isNaN(start) || start >= size || end < start) {
      response.statusCode = 416;
      response.setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }

    response.statusCode = 206;
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    response.setHeader('Accept-Ranges', 'bytes');
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  if (type.startsWith('video/')) response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Length', String(size));
  createReadStream(filePath).pipe(response);
}

function tryServe(response, filePath, request = null) {
  if (!existsSync(filePath)) return false;
  if (!statSync(filePath).isFile()) return false;
  sendFile(response, filePath, 200, request);
  return true;
}

const server = createServer(async (request, response) => {
  const startedAt = process.hrtime.bigint();
  const requestId = newRequestId();

  /*
   * `pathname` پیش از try فقط «مسیر پیش‌فرض لاگ» است. مقدار واقعی داخل try
   * حساب می‌شود تا مسیر بدشکل (`/%ZZ`) همان‌طور که پیش‌تر بود به catch بیرونی
   * برسد و ۵۰۰ بدهد — نه اینکه استثنا از هندلر بیرون بزند و پروسه را ببرد.
   */
  let pathname = '/';

  response.setHeader('X-Request-Id', requestId);

  /*
   * هدرهای امنیتی (فاز ۸) — روی **همهٔ** پاسخ‌ها، از جمله فایل‌های آپلودی.
   * چرا روی آپلود هم: یک SVG آپلودی می‌تواند اسکریپت داشته باشد؛ CSP همراه
   * پاسخ، اجرای آن را در مرورگر می‌بندد.
   */
  applySecurityHeaders(response, request, SECURITY_OPTIONS);

  /* یک بار ثبت در پایان پاسخ؛ برای پاسخ‌های جریانی (فایل) هم کار می‌کند */
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    metrics.record({
      method: request.method,
      path: pathname,
      status: response.statusCode,
      durationMs,
    });

    if (accessLogOn) {
      console.log(
        accessLogLine({
          requestId,
          method: request.method,
          path: pathname,
          status: response.statusCode,
          durationMs,
        }),
      );
    }
  });

  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);

    /*
     * سلامت/آمادگی/متریک — پیش از هندلرهای API.
     *
     * چرا پیش از آن‌ها: این‌ها نباید به سشن، کوکی، CSRF یا نوشتن روی دیسک
     * وابسته باشند، و باید حتی وقتی داده خراب است هم جواب بدهند. `/healthz`
     * عمداً هیچ چیزی را نمی‌سنجد (liveness) و `/readyz` سنجش‌ها را جدا گزارش
     * می‌کند تا معلوم باشد کدام بخش آماده نیست.
     */
    if (pathname === '/healthz' || pathname === '/readyz' || pathname === '/metrics' || pathname === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'متد پشتیبانی نمی‌شود' } });
        return;
      }

      if (pathname === '/healthz') {
        sendJson(response, 200, { status: 'ok', uptimeSeconds: metrics.snapshot().uptimeSeconds });
        return;
      }

      /*
       * نام عمومی سلامت برای load balancer و پایش بیرونی.
       * عمداً همان liveness است (بدون سنجش وابستگی) تا حتی با دادهٔ خراب هم
       * ۲۰۰ بدهد؛ سنجش وابستگی‌ها کار `/readyz` است. پاسخ هیچ مسیر داخلی،
       * نسخهٔ دقیق، stack یا secret ندارد.
       */
      if (pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok', uptimeSeconds: metrics.snapshot().uptimeSeconds });
        return;
      }

      if (pathname === '/readyz') {
        const report = checkReadiness({ distDir, dataDir });
        sendJson(response, report.ready ? 200 : 503, report);
        return;
      }

      /* نبودِ توکن یا توکن نادرست ⇒ ۴۰۴ (نه ۴۰۳) تا وجود مسیر لو نرود */
      if (!metricsToken || !isMetricsAuthorized(request.headers.authorization, metricsToken)) {
        sendJson(response, 404, { success: false, error: { code: 'NOT_FOUND', message: 'مسیر پیدا نشد' } });
        return;
      }

      sendJson(response, 200, metrics.snapshot());
      return;
    }

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

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.statusCode = 405;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'متد پشتیبانی نمی‌شود' } }));
      return;
    }

    /* نقشهٔ سایت و robots — در dist ساخته می‌شوند (`scripts/generate-sitemap.mjs`) */
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      if (tryServe(response, resolve(distDir, `.${pathname}`), request)) return;
    }

    /* فایل‌های آپلودی پنل — همان ماژولی که سرور توسعه استفاده می‌کند */
    if (serveUploadRequest(request, response, pathname)) return;

    /* دارایی‌های Build — مسیر حل‌شده باید داخل dist بماند (ضد path traversal) */
    const assetPath = resolve(distDir, `.${pathname}`);
    if (isInside(distDir, assetPath) && tryServe(response, assetPath, request)) return;

    /* SPA fallback: مسیرهای بدون پسوند به index.html (با متای تزریق‌شده) */
    if (!extname(pathname)) {
      if (indexHtmlCache || existsSync(indexHtmlPath)) {
        serveIndexHtml(response, request);
        return;
      }
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

/*
 * گارد راه‌اندازی credential مدیر (فاز ۹).
 *
 * اگر هیچ مدیری روی دیسک نباشد، seed باید اجرا شود. در production، seed بدون
 * `TAPESH_ADMIN_PASSWORD` صریح **ممنوع** است؛ پس همان اول می‌ایستیم — نه اینکه
 * سرور با رمز پیش‌فرض شناخته‌شده بالا بیاید.
 */
const adminsFile = resolve(dataDir, 'content', 'admins.json');

function hasUsableAdmin() {
  if (!existsSync(adminsFile)) return false;
  try {
    const parsed = JSON.parse(readFileSync(adminsFile, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

if (!hasUsableAdmin()) {
  try {
    const decision = assertAdminCredentialUsable();
    if (DEV && decision.mustChangePassword) {
      console.warn('⚠️ توسعه: رمز مدیر از TAPESH_ADMIN_PASSWORD نیامده؛ رمز محلی موقت فعال است.');
    }
  } catch (error) {
    console.error(`✗ راه‌اندازی متوقف شد — ${error.message}`);
    process.exit(1);
  }
}

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
