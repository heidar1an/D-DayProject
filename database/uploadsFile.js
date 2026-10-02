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
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
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
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
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

/*
 * پسوندهایی که **درون‌مرورگری** سرو می‌شوند (تصویر، فونت، ویدیو، زیرنویس، PDF).
 *
 * چرا فهرست صریح (فاز ۷ — امنیت آپلود): جدول MIME چند پسوند قابل‌اجرا
 * (`html`, `js`, `mjs`, `css`, `json`) را هم با نوع واقعی‌شان سرو می‌کرد. مسیر
 * نوشتن آپلود هرگز چنین فایل‌هایی تولید نمی‌کند (فقط تصویر/PDF/ویدیو/زیرنویس)،
 * ولی «سرو کردن چیزی که نمی‌سازیم» سطح حملهٔ بی‌دلیل است: اگر روزی فایلی با آن
 * پسوند در پوشه ظاهر شود، مرورگر آن را **در همین origin** اجرا می‌کند.
 *
 * حالا هر پسوندی که در این فهرست نباشد با `application/octet-stream` و
 * `Content-Disposition: attachment` می‌رود ⇒ **دانلود، نه اجرا**.
 *
 * نکته: `.svg` عمداً درون‌مرورگری می‌ماند (رسانهٔ مشروع تپش است) و ریسک اسکریپت
 * آن با CSP روی همان پاسخ بسته می‌شود (`server.js` هدرهای امنیتی را روی همهٔ
 * پاسخ‌ها، از جمله آپلودها، می‌گذارد).
 */
const INLINE_SAFE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.bmp', '.tiff', '.heic', '.heif',
  '.svg',
  '.woff', '.woff2',
  '.mp4', '.webm', '.ogv', '.mov', '.mkv',
  '.mp3', '.m4a', '.wav', '.ogg',
  '.vtt', '.srt',
  '.pdf',
  '.txt',
]);

/*
 * قالب‌های رسانه‌ای که برچسب `Accept-Ranges` می‌گیرند و Range برایشان معنا دارد.
 * عمداً فقط **درون‌مرورگری**ها: فایلی که `attachment` می‌رود، بازه‌بندی بی‌فایده
 * است و ادعای پشتیبانی هم نباید بکند.
 */
const RANGE_CAPABLE = (type) => type.startsWith('video/') || type.startsWith('audio/') || type === 'application/pdf';
/*
 * ETag قوی از «حجم + زمان تغییر». چرا لازم است (فاز ۷ — کش و درخواست شرطی):
 * پیش از این فقط تصویر و فونت `Cache-Control` داشتند؛ ویدیو، PDF و زیرنویس
 * **هیچ** نشانهٔ کشی نداشتند، پس مرورگر هر بار کل فایل را دوباره می‌گرفت. با
 * ETag + `Last-Modified`، مرورگر می‌تواند درخواست شرطی بزند و ۳۰۴ بگیرد —
 * بی‌آنکه محتوای کهنه سرو شود (چون همیشه اعتبارسنجی می‌شود).
 */
function entityTagOf(size, mtimeMs) {
  return `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}

/* مقایسهٔ لیست `If-None-Match` با ETag فعلی؛ `*` یعنی «هر نسخه‌ای» */
function etagMatches(header, etag) {
  const raw = String(header ?? '').trim();
  if (!raw) return false;
  if (raw === '*') return true;
  return raw.split(',').map((part) => part.trim().replace(/^W\//, '')).includes(etag);
}

function send(response, filePath, status, request) {
  const extension = extname(filePath).toLowerCase();
  const inlineSafe = INLINE_SAFE_EXTENSIONS.has(extension);
  const type = inlineSafe
    ? (MIME_TYPES[extension] ?? 'application/octet-stream')
    : 'application/octet-stream';

  const stats = statSync(filePath);
  const size = stats.size;
  const etag = entityTagOf(size, stats.mtimeMs);
  const lastModified = new Date(stats.mtimeMs).toUTCString();

  response.statusCode = status;
  response.setHeader('Content-Type', type);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  /* پسوند غیرمجاز ⇒ دانلود اجباری، تا هرگز در origin اجرا نشود */
  if (!inlineSafe) response.setHeader('Content-Disposition', 'attachment');

  /* تصویر و فونت نام‌شان محتوامحور است ⇒ کش بلندمدت. بقیه اعتبارسنجی می‌شوند. */
  if (type.startsWith('image/') || type.startsWith('font/')) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  response.setHeader('ETag', etag);
  response.setHeader('Last-Modified', lastModified);
  /* فقط برای رسانه‌هایی که واقعاً بازه می‌دهند — ادعای بی‌پشتوانه نمی‌کنیم */
  if (RANGE_CAPABLE(type)) response.setHeader('Accept-Ranges', 'bytes');

  /*
   * درخواست شرطی ⇒ ۳۰۴ بدون بدنه. عمداً **پیش از** Range سنجیده می‌شود:
   * اگر نسخه عوض نشده باشد، حتی برای درخواست Range هم پاسخ درست «۳۰۴» است.
   * (مرورگرها برای رسانه معمولاً Range می‌فرستند؛ بدون این، ویدیوی تغییرنکرده
   * دوباره از دیسک خوانده و فرستاده می‌شد.)
   */
  const ifNoneMatch = request?.headers?.['if-none-match'];
  const ifModifiedSince = request?.headers?.['if-modified-since'];

  /* دقت زمانی HTTP یک ثانیه است، پس مقایسه هم روی همان دقت انجام می‌شود */
  const mtimeSeconds = Math.floor(stats.mtimeMs / 1000) * 1000;
  const sinceSeconds = ifModifiedSince ? new Date(ifModifiedSince).getTime() : NaN;

  const notModified = ifNoneMatch
    ? etagMatches(ifNoneMatch, etag)
    : Number.isFinite(sinceSeconds) && mtimeSeconds <= sinceSeconds;

  if (notModified) {
    response.statusCode = 304;
    response.removeHeader('Content-Length');
    response.end();
    return;
  }

  if (request?.method === 'HEAD') {
    response.setHeader('Content-Length', String(size));
    response.end();
    return;
  }

  /*
   * پشتیبانی Range. بدون این، مرورگر کل فایل را از ابتدا می‌گیرد و
   * «جابه‌جایی در تایم‌لاین» کار نمی‌کند (سافاری حتی پخش را شروع نمی‌کند).
   * فقط یک بازه پذیرفته می‌شود؛ `multipart/byteranges` لازم نیست.
   *
   * برای هر نوع رسانه‌ای که `Accept-Ranges` می‌گیرد کار می‌کند (ویدیو، صدا، PDF).
   * برای بقیه نادیده گرفته می‌شود تا با ادعای هدر تناقض نداشته باشد.
   */
  const rangeHeader = RANGE_CAPABLE(type) ? request?.headers?.range : null;
  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim()) : null;

  if (match) {
    let start;
    let end;

    if (!match[1] && match[2]) {
      /* `bytes=-N` = N بایت آخر */
      const tail = Math.min(Number(match[2]), size);
      start = size - tail;
      end = size - 1;
    } else {
      start = match[1] ? Number(match[1]) : 0;
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    }

    if (Number.isNaN(start) || Number.isNaN(end) || start >= size || end < start) {
      response.statusCode = 416;
      response.setHeader('Content-Range', `bytes */${size}`);
      response.removeHeader('Content-Length');
      response.end();
      return;
    }

    response.statusCode = 206;
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

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
