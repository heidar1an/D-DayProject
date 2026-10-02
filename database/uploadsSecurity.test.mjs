/*
 * آزمون امنیت سرو آپلود — فاز ۷ (امنیت آپلود و انبار).
 *
 * چه چیزی را اثبات می‌کند:
 *   • مسیر بیرون از پوشهٔ آپلود هرگز به دیسک نمی‌رسد (`path traversal`).
 *   • فایل ناموجود ⇒ ۴۰۴ صریح JSON، نه سقوط به HTML اسپا.
 *   • پسوند **قابل‌اجرا** (`html`, `js`, `mjs`, `css`, `json`) با
 *     `application/octet-stream` + `Content-Disposition: attachment` سرو می‌شود —
 *     یعنی دانلود، نه اجرا در همین origin. این همان لایهٔ دفاعی است که اگر روزی
 *     فایلی با آن پسوند در پوشه ظاهر شود، جلوی stored-XSS را می‌گیرد.
 *   • رسانهٔ مشروع (تصویر/PDF/زیرنویس) هنوز با نوع درست و **بدون** attachment
 *     سرو می‌شود؛ یعنی سخت‌گیری، پخش مشروع را نشکسته.
 *   • `nosniff` روی همهٔ پاسخ‌ها هست.
 *
 * رویکرد: فایل‌های آزمون با نام یکتا **داخل خود `public/uploads`** ساخته و در
 * `finally` حذف می‌شوند. دلیلش این است که `serveUploadRequest` عمداً فقط داخل
 * `UPLOADS_DIR` را می‌بیند؛ اگر تست را به پوشهٔ دیگری ببریم، در واقع همان تابع
 * تصمیم‌گیرنده را نمی‌سنجیم. درخواست با متد `HEAD` فرستاده می‌شود تا بدنه جریانی
 * نشود و صرفاً هدرها سنجیده شوند.
 *
 * اجرا: `node --test database/uploadsSecurity.test.mjs`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { UPLOADS_DIR, UPLOADS_URL_PREFIX, serveUploadRequest, uploadPathOf } from './uploadsFile.js';

/*
 * `response` جعلی — همان سطحی که این ماژول لازم دارد.
 *
 * روی `EventEmitter` ساخته شده تا `createReadStream(...).pipe(response)` واقعاً
 * کار کند: `pipe` به `on/once/removeListener/emit` نیاز دارد و اگر نباشند،
 * `onfinish` با TypeError می‌ترکد. بدنه هم **همگام** جمع می‌شود تا سنجه‌های
 * همگامِ قبلی (مثل ۴۰۴) دست‌نخورده بمانند.
 */
function fakeResponse() {
  const headers = new Map();
  const response = new EventEmitter();

  response.statusCode = 200;
  response.chunks = [];
  response.setHeader = (name, value) => { headers.set(String(name).toLowerCase(), String(value)); };
  response.getHeader = (name) => headers.get(String(name).toLowerCase());
  response.removeHeader = (name) => { headers.delete(String(name).toLowerCase()); };
  response.write = (chunk) => { if (chunk) response.chunks.push(chunk); return true; };
  response.end = (chunk) => {
    if (chunk) response.chunks.push(chunk);
    response.ended = true;
    response.emit('finish');
    return response;
  };

  return response;
}

const unique = (extension) => `e2e-${randomBytes(6).toString('hex')}${extension}`;

/*
 * فایل‌های آزمونی که همین حالا روی دیسک‌اند + خودترمیمی.
 *
 * چرا لازم است: این پوشه (`public/uploads`) **سرو می‌شود**، پس ماندن یک زائد
 * فقط «کثیفی» نیست — یک فایل قابل‌دریافت در محصول است. پیش‌تر ۶ زائد `e2e-*`
 * از یک اجرای نیمه‌کاره در همین پوشه انبار شده بود و هیچ دروازه‌ای آن را ندید.
 *
 * دو لایه:
 *   ۱. `healStaleArtifacts()` در **بارگذاری ماژول** — در این لحظه هیچ فایلی از
 *      این اجرا وجود ندارد، پس هر `e2e-*` که هست زائد اجراهای قبلی است و پاک
 *      می‌شود. نتیجه: پوشه هرگز انبار نمی‌شود و یک اجرای شکست‌خورده، اجرای
 *      بعدی را قرمز نمی‌کند (حلقهٔ بازخورد مثبت شکل نمی‌گیرد).
 *   ۲. تور ایمنی `exit` — بازماندهٔ همین پروسه را پاک می‌کند.
 *
 * عمداً هیچ سنجهٔ درون‌آزمونی بر پایهٔ `mtime` نیست: آزمون‌ها هم‌زمان اجرا
 * می‌شوند و سنجش پوشه در میانهٔ کار به‌طور تصادفی قرمز می‌شود — و آن قرمزِ
 * تصادفی، اجرا را وسط کار قطع می‌کند و خودش زائد بیشتری جا می‌گذارد. سنجهٔ
 * «صفر زائد» در `scripts/repo-hygiene.mjs` است، آنجا که جای درستش است.
 *
 * پیشوند `e2e-` رزروِ همین آزمون است (`unique()`)، پس پاک‌کردن آن با این
 * پیشوند هیچ آپلود واقعی محصول را هدف نمی‌گیرد.
 */
const createdPaths = new Set();

function healStaleArtifacts() {
  let healed = 0;
  for (const name of readdirSync(UPLOADS_DIR)) {
    if (!name.startsWith('e2e-')) continue;
    rmSync(join(UPLOADS_DIR, name), { force: true });
    healed += 1;
  }
  return healed;
}

/* خروجی نادیده گرفته نمی‌شود: شمارش در پیام آزمون‌های بعدی گزارش می‌شود. */
const healedStaleArtifacts = healStaleArtifacts();

process.on('exit', () => {
  for (const path of createdPaths) rmSync(path, { force: true });
});

/*
 * فایل آزمون را می‌سازد و **پس از پایان کار** پاک می‌کند.
 * بدنه می‌تواند همگام یا نامتقارن باشد؛ در حالت نامتقارن، پاک‌سازی تا حل‌شدن
 * Promise عقب می‌افتد (وگرنه فایل پیش از خواندن جریانی حذف می‌شد و ENOENT می‌داد).
 */
function withTempUpload(extension, contents, body) {
  const name = unique(extension);
  const path = join(UPLOADS_DIR, name);
  let result;

  const cleanup = () => {
    rmSync(path, { force: true });
    createdPaths.delete(path);
  };

  try {
    writeFileSync(path, contents);
    createdPaths.add(path);
    result = body(name, path);
  } catch (error) {
    cleanup();
    throw error;
  }

  if (result && typeof result.then === 'function') {
    return result.finally(cleanup);
  }

  cleanup();
  return result;
}

function request(name, { method = 'HEAD', headers = {} } = {}) {
  const response = fakeResponse();
  const handled = serveUploadRequest(
    { method, headers },
    response,
    `${UPLOADS_URL_PREFIX}${name}`,
  );
  return { handled, response };
}

function head(name, headers = {}) {
  return request(name, { method: 'HEAD', headers });
}

/* برای GET بدنه جریانی می‌شود؛ تا بسته‌شدن پاسخ صبر می‌کنیم */
function get(name, headers = {}) {
  return new Promise((done) => {
    const response = fakeResponse();
    response.on('finish', () => done({ response }));
    serveUploadRequest({ method: 'GET', headers }, response, `${UPLOADS_URL_PREFIX}${name}`);
    /* پاسخ‌های بدون بدنه (۳۰۴/۴۱۶) هم `end` می‌شوند، پس همین کافی است */
  });
}

test('مسیر بیرون از /uploads هرگز مسیر دیسک نمی‌شود (path traversal)', () => {
  assert.equal(uploadPathOf('/assets/index.js'), null);
  assert.equal(uploadPathOf('/uploads/../users.json'), null);
  assert.equal(uploadPathOf('/uploads/../../database/users.json'), null);
  /*
   * `server.js` مسیر را **پیش از** این تابع با `decodeURIComponent` باز می‌کند،
   * پس معادل رمزگذاری‌شده هم باید همان نتیجهٔ امن را بدهد. (اگر همان رشتهٔ
   * رمزگذاری‌شده به این تابع برسد، یک نام فایل تحت‌اللفظی داخل پوشهٔ آپلود است و
   * بیرون نمی‌زند — یعنی هر دو مسیر امن‌اند.)
   */
  assert.equal(uploadPathOf(decodeURIComponent('/uploads/%2e%2e/users.json')), null);
  assert.equal(uploadPathOf(decodeURIComponent('/uploads/%2e%2e%2fusers.json')), null);
});

test('مسیر مشروع داخل پوشهٔ آپلود می‌ماند', () => {
  const target = uploadPathOf(`${UPLOADS_URL_PREFIX}photo.png`);
  assert.ok(target, 'مسیر باید حل شود');
  assert.ok(target.startsWith(UPLOADS_DIR), `${target} باید داخل ${UPLOADS_DIR} باشد`);
});

test('فایل ناموجود زیر /uploads ⇒ ۴۰۴ صریح (نه سقوط به HTML اسپا)', () => {
  const { handled, response } = head('definitely-missing-e2e.png');

  assert.equal(handled, true, 'درخواست باید توسط لایهٔ آپلود مدیریت شود');
  assert.equal(response.statusCode, 404);
  assert.match(response.getHeader('content-type'), /application\/json/);
  assert.match(response.chunks.join(''), /NOT_FOUND/);
});

test('پسوند قابل‌اجرا ⇒ octet-stream + attachment (دانلود، نه اجرا در origin)', () => {
  for (const extension of ['.html', '.js', '.mjs', '.css', '.json']) {
    withTempUpload(extension, '<script>alert(1)</script>', (name) => {
      const { handled, response } = head(name);

      assert.equal(handled, true, `${extension} باید مدیریت شود`);
      assert.equal(response.statusCode, 200, `${extension} باید ۲۰۰ بدهد`);
      assert.equal(
        response.getHeader('content-type'),
        'application/octet-stream',
        `${extension} نباید نوع اجرایی بگیرد`,
      );
      assert.equal(
        response.getHeader('content-disposition'),
        'attachment',
        `${extension} باید دانلود اجباری شود`,
      );
      assert.equal(response.getHeader('x-content-type-options'), 'nosniff');
    });
  }
});

test('رسانهٔ مشروع هنوز درون‌مرورگری و با نوع درست سرو می‌شود', () => {
  const expected = {
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.vtt': 'text/vtt; charset=utf-8',
  };

  for (const [extension, type] of Object.entries(expected)) {
    withTempUpload(extension, 'x', (name) => {
      const { response } = head(name);

      assert.equal(response.statusCode, 200);
      assert.equal(response.getHeader('content-type'), type, `${extension} نوع درست را نگرفت`);
      assert.equal(
        response.getHeader('content-disposition'),
        undefined,
        `${extension} نباید attachment بگیرد (پخش مشروع باید کار کند)`,
      );
      assert.equal(response.getHeader('x-content-type-options'), 'nosniff');
    });
  }
});

/* ─────────────── کش اعتبارسنجی‌شده: ETag / Last-Modified / ۳۰۴ ─────────────── */

test('همهٔ پاسخ‌ها ETag و Last-Modified دارند (بدون ادعای کش کورکورانه)', () => {
  withTempUpload('.png', 'image-bytes', (name) => {
    const { response } = head(name);

    assert.equal(response.statusCode, 200);
    assert.match(response.getHeader('etag'), /^"[0-9a-f]+-[0-9a-f]+"$/, 'ETag قوی از حجم+زمان');
    assert.ok(response.getHeader('last-modified'), 'Last-Modified باید باشد');
  });
});

test('If-None-Match با ETag درست ⇒ ۳۰۴ بدون بدنه', async () => {
  await withTempUpload('.png', 'image-bytes', async (name) => {
    const { response: first } = head(name);
    const etag = first.getHeader('etag');

    const { response } = await get(name, { 'if-none-match': etag });
    assert.equal(response.statusCode, 304);
    assert.equal(response.chunks.length, 0, '۳۰۴ نباید بدنه داشته باشد');
    assert.equal(response.getHeader('content-length'), undefined);
  });
});

test('If-None-Match با ETag نادرست ⇒ بدنه سرو می‌شود (کش کهنه نمی‌ماند)', async () => {
  await withTempUpload('.txt', 'fresh-bytes', async (name) => {
    const { response } = await get(name, { 'if-none-match': '"deadbeef-0"' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.chunks.join(''), 'fresh-bytes');
  });
});

test('If-Modified-Since در آینده ⇒ ۳۰۴', async () => {
  await withTempUpload('.txt', 'same-bytes', async (name) => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const { response } = await get(name, { 'if-modified-since': future });
    assert.equal(response.statusCode, 304);
  });
});

/* ───────────────────────────── Range ───────────────────────────── */

test('Range روی PDF ⇒ ۲۰۶ با Content-Range و تعداد بایت درست', async () => {
  await withTempUpload('.pdf', '0123456789', async (name) => {
    const { response } = await get(name, { range: 'bytes=2-5' });

    assert.equal(response.statusCode, 206);
    assert.equal(response.getHeader('content-range'), 'bytes 2-5/10');
    assert.equal(response.getHeader('content-length'), '4');
    assert.equal(response.getHeader('accept-ranges'), 'bytes');
    assert.equal(response.chunks.join(''), '2345');
  });
});

test('Range دنباله‌ای (bytes=-N) ⇒ N بایت آخر', async () => {
  await withTempUpload('.pdf', '0123456789', async (name) => {
    const { response } = await get(name, { range: 'bytes=-3' });
    assert.equal(response.statusCode, 206);
    assert.equal(response.getHeader('content-range'), 'bytes 7-9/10');
    assert.equal(response.chunks.join(''), '789');
  });
});

test('Range از ابتدا (bytes=0-) ⇒ کل فایل', async () => {
  await withTempUpload('.pdf', '0123456789', async (name) => {
    const { response } = await get(name, { range: 'bytes=0-' });
    assert.equal(response.statusCode, 206);
    assert.equal(response.getHeader('content-range'), 'bytes 0-9/10');
    assert.equal(response.chunks.join(''), '0123456789');
  });
});

test('Range بیرون از حجم فایل ⇒ ۴۱۶ با Content-Range ستاره', async () => {
  await withTempUpload('.pdf', '0123456789', async (name) => {
    const { response } = await get(name, { range: 'bytes=50-60' });
    assert.equal(response.statusCode, 416);
    assert.equal(response.getHeader('content-range'), 'bytes */10');
    assert.equal(response.chunks.length, 0);
  });
});

test('صدا نوع درست و پشتیبانی Range می‌گیرد', () => {
  withTempUpload('.mp3', 'audio-bytes', (name) => {
    const { response } = head(name);
    assert.equal(response.getHeader('content-type'), 'audio/mpeg');
    assert.equal(response.getHeader('accept-ranges'), 'bytes');
    assert.equal(response.getHeader('content-disposition'), undefined);
  });
});

test('Range برای فایل غیرقابل‌پخش (attachment) نادیده گرفته می‌شود و ادعا هم نمی‌شود', async () => {
  await withTempUpload('.html', '<b>x</b>', async (name) => {
    const { response } = await get(name, { range: 'bytes=0-1' });

    assert.equal(response.statusCode, 200, 'دانلود باید کل فایل را بدهد');
    assert.equal(response.getHeader('accept-ranges'), undefined, 'ادعای بی‌پشتوانه نکن');
    assert.equal(response.getHeader('content-disposition'), 'attachment');
  });
});

test('زیرنویس (غیر رسانه‌ای) همچنان ۲۰۰ کامل و بدون Accept-Ranges می‌گیرد', async () => {
  await withTempUpload('.vtt', 'WEBVTT\n', async (name) => {
    const { response } = await get(name, { range: 'bytes=0-3' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.getHeader('accept-ranges'), undefined);
    assert.equal(response.getHeader('content-type'), 'text/vtt; charset=utf-8');
  });
});

test('جدول MIME و فهرست درون‌مرورگری با هم هم‌خوان‌اند (بدون نوع octet-stream سرگردان)', () => {
  /*
   * اگر پسوندی در فهرست درون‌مرورگری باشد ولی در جدول MIME نباشد، فایل
   * «مجاز» شمرده می‌شود ولی با `application/octet-stream` می‌رود — یعنی مرورگر
   * باز هم دانلودش می‌کند. این سنجه جلوی آن ناسازگاری را می‌گیرد.
   */
  for (const extension of ['.avif', '.bmp', '.tiff', '.heic', '.heif', '.mp3', '.m4a', '.wav', '.ogg']) {
    withTempUpload(extension, 'x', (name) => {
      const { response } = head(name);
      const type = response.getHeader('content-type');
      assert.notEqual(type, 'application/octet-stream', `${extension} نوع واقعی خودش را نگرفت`);
      assert.equal(response.getHeader('content-disposition'), undefined, `${extension} باید درون‌مرورگری بماند`);
    });
  }
});
