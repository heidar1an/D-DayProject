/*
 * سرو کردن فایل‌های بارگذاری‌شدهٔ پنل (`public/uploads/…`).
 *
 * چرا یک ماژول جدا: ویت ۷ فهرست فایل‌های `public/` را **یک‌بار در زمان
 * راه‌اندازی سرور توسعه** کش می‌کند (`publicFilesMap`) و بعد فقط همان‌ها را سرو
 * می‌کند. نتیجه این بود که هر فایلی که بعد از بالا آمدن سرور بارگذاری می‌شد
 * (ویدیو و زیرنویس دوره‌های بین‌الملل) سرو نمی‌شد و درخواستش به HTML اسپا
 * می‌افتاد؛ پخش‌کننده هیچ خطایی نمی‌داد و فقط سیاه می‌ماند.
 *
 * این ماژول در هر درخواست از دیسک می‌خواند، پس هم در توسعه و هم در
 * پروداکشن یک رفتار دارد. `server.js` هم همین را استفاده می‌کند تا منطق
 * Range و نوع فایل دو جا تکرار نشود.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const UPLOADS_DIR = resolve(rootDir, 'public', 'uploads');
export const UPLOADS_URL_PREFIX = '/uploads/';

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

/* مسیر فایل روی دیسک از آدرس درخواست — `null` اگر بیرون از پوشهٔ آپلود باشد */
export function uploadPathOf(pathname) {
  if (!pathname.startsWith(UPLOADS_URL_PREFIX)) return null;
  const target = resolve(UPLOADS_DIR, `.${pathname.slice(UPLOADS_URL_PREFIX.length - 1)}`);
  return isInside(UPLOADS_DIR, target) ? target : null;
}

function send(response, filePath, status, request) {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const size = statSync(filePath).size;

  response.statusCode = status;
  response.setHeader('Content-Type', type);
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (type.startsWith('image/') || type.startsWith('font/')) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  /*
   * پشتیبانی Range برای ویدیو. بدون این، مرورگر کل فایل را از ابتدا می‌گیرد و
   * «جابه‌جایی در تایم‌لاین» کار نمی‌کند (سافاری حتی پخش را شروع نمی‌کند).
   * فقط یک بازه پذیرفته می‌شود؛ `multipart/byteranges` لازم نیست.
   */
  const range = type.startsWith('video/') ? request?.headers?.range : null;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;

  if (request?.method === 'HEAD') {
    response.setHeader('Content-Length', String(size));
    if (type.startsWith('video/')) response.setHeader('Accept-Ranges', 'bytes');
    response.end();
    return;
  }

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

/*
 * اگر آدرس زیر `/uploads/` بود، خودش پاسخ می‌دهد و `true` برمی‌گرداند.
 *
 * فایل نبود ⇒ **۴۰۴ صریح**، نه سقوط به HTML اسپا. اگر HTML برگردانیم،
 * پخش‌کنندهٔ ویدیو خطای بی‌معنا می‌دهد و علت واقعی (نبودِ فایل) پنهان می‌ماند.
 */
export function serveUploadRequest(request, response, pathname) {
  const target = uploadPathOf(pathname);
  if (!target) return pathname.startsWith(UPLOADS_URL_PREFIX);

  if (!existsSync(target) || !statSync(target).isFile()) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'فایل پیدا نشد' } }));
    return true;
  }

  send(response, target, 200, request);
  return true;
}
