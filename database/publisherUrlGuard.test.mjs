/*
 * تست گارد SSRF آدرس پایهٔ سرویس‌های انتشار (فاز ۱۷ پیشنهادی — بند SSRF).
 *
 * مسئلهٔ اثبات‌شده: آدرس پایهٔ هر آداپتور از متغیر محیطی خوانده می‌شود
 * (`BALE_API_BASE` · `EITAA_API_BASE` · `TELEGRAM_API_BASE`) با پیش‌فرض ثابت، و
 * **هیچ** اعتبارسنجی protocol/میزبان وجود نداشت. چون توکن ربات در **مسیر URL**
 * می‌رود، تغییر آن متغیر به یک میزبان داخلی = SSRF + نشت توکن.
 *
 * این فایل اثبات می‌کند:
 *   ۱) میزبان‌های خصوصی/loopback/link-local/متادیتا تشخیص داده می‌شوند —
 *      از جمله معادل‌های عددی IPv4 که از فیلتر رشته‌ای ساده رد می‌شوند.
 *   ۲) آدرس‌های پیش‌فرض واقعی سه پلتفرم همچنان پذیرفته می‌شوند (بدون شکستن رفتار).
 *   ۳) آداپتور واقعی (`bale`) هنگام آلودگی env **پرتاب** می‌کند.
 *   ۴) استثنای توسعهٔ محلی فقط با env صریح کار می‌کند.
 *
 * اجرا: `node --test database/publisherUrlGuard.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const {
  assertSafeApiBase, isBlockedHost, privateBaseAllowed, ALLOW_PRIVATE_BASE_ENV, INSECURE_BASE_CODE,
} = await import('./publishers/urlGuard.js');

const { baleApiBase } = await import('./publishers/bale.js');

const withEnv = (name, value, run) => {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
};

/* ── ۱) تشخیص میزبان ────────────────────────────────────────────────────── */

test('میزبان‌های داخلی/خصوصی/متادیتا مسدود می‌شوند', () => {
  const blocked = [
    'localhost', 'api.localhost', 'printer.local', 'vault.internal', 'metadata.google.internal',
    '127.0.0.1', '127.1.2.3', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.254',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    /* معادل‌های عددی IPv4 — `new URL` نرمال‌شان نمی‌کند */
    '2130706433', '0x7f000001', '0177.0.0.1',
    /* IPv6 */
    '::1', '[::1]', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
  ];
  for (const host of blocked) assert.equal(isBlockedHost(host), true, `${host} باید مسدود باشد`);
});

test('میزبان‌های عمومی واقعی مسدود نمی‌شوند', () => {
  const allowed = ['api.telegram.org', 'tapi.bale.ai', 'eitaayar.ir', 'graph.facebook.com', '8.8.8.8', 'example.com', 'a.b.c.example.org'];
  for (const host of allowed) assert.equal(isBlockedHost(host), false, `${host} نباید مسدود باشد`);
});

/* ── ۲) آدرس‌های پیش‌فرض واقعی ───────────────────────────────────────────── */

test('آدرس‌های پیش‌فرض سه پلتفرم پذیرفته می‌شوند و اسلش انتهایی حذف می‌شود', () => {
  assert.equal(assertSafeApiBase('https://api.telegram.org/bot', { envName: 'TELEGRAM_API_BASE' }), 'https://api.telegram.org/bot');
  assert.equal(assertSafeApiBase('https://tapi.bale.ai/bot/', { envName: 'BALE_API_BASE' }), 'https://tapi.bale.ai/bot');
  assert.equal(assertSafeApiBase('https://eitaayar.ir/api//', { envName: 'EITAA_API_BASE' }), 'https://eitaayar.ir/api');
});

test('آدرس پایهٔ بله بدون دست‌کاری env سالم برمی‌گردد', () => {
  withEnv('BALE_API_BASE', undefined, () => {
    assert.equal(baleApiBase(), 'https://tapi.bale.ai/bot');
  });
});

/* ── ۳) رد کردن آدرس‌های ناامن ──────────────────────────────────────────── */

test('آدرس‌های ناامن با کد PUBLISH_INSECURE_BASE رد می‌شوند', () => {
  const rejected = [
    ['', 'خالی'],
    ['   ', 'فقط فاصله'],
    ['not a url', 'بی‌ساختار'],
    ['ftp://api.telegram.org', 'protocol ناامن'],
    ['file:///etc/passwd', 'protocol فایل'],
    ['http://127.0.0.1:8080', 'loopback'],
    ['http://169.254.169.254/latest/meta-data', 'متادیتای ابری'],
    ['http://[::1]:9000', 'loopback v6'],
    ['https://user:pass@api.telegram.org', 'اعتبارنامهٔ درون URL'],
    ['http://2130706433/', 'loopback به شکل عددی'],
    ['http://vault.internal/api', 'دامنهٔ داخلی'],
    ['http://printer.local/api', 'دامنهٔ محلی'],
  ];
  for (const [base, label] of rejected) {
    assert.throws(
      () => assertSafeApiBase(base, { envName: 'TEST_API_BASE', platform: 'تست' }),
      (error) => error?.code === INSECURE_BASE_CODE,
      `${label} باید رد شود`,
    );
  }
});

/* ── ۴) اتصال واقعی به آداپتور ─────────────────────────────────────────── */

test('آداپتور بله با env آلوده پرتاب می‌کند (گارد واقعاً وصل است)', () => {
  withEnv('BALE_API_BASE', 'http://127.0.0.1:9999/bot', () => {
    assert.throws(() => baleApiBase(), (error) => error?.code === INSECURE_BASE_CODE);
  });
  withEnv('BALE_API_BASE', 'http://169.254.169.254/bot', () => {
    assert.throws(() => baleApiBase(), (error) => error?.code === INSECURE_BASE_CODE);
  });
});

/* ── ۶) پوشش ساختاری همهٔ آدرس‌های پایهٔ env-محور ──────────────────────── */

test('هر چهار آداپتور env-محور گارد دارند و مسیر ناگارد باقی نمانده', () => {
  const files = ['bale.js', 'eitaa.js', 'telegramLike.js', 'instagram.js'];
  const baseEnvPattern = /(_API_BASE|_GRAPH_BASE|apiBaseEnv)/;

  for (const file of files) {
    const text = readFileSync(resolve(HERE, 'publishers', file), 'utf8');
    assert.match(text, /assertSafeApiBase\(/, `${file} گارد SSRF ندارد`);

    /* هیچ خطی نباید آدرس پایهٔ سرویس را بی‌گارد نرمال کند.
       (خطوط `PUBLIC_SITE_URL` عمداً استثناست: آن آدرس خودِ سایت است، نه مقصد
       بیرونی که توکن به آن می‌رود.) */
    const unguarded = text
      .split('\n')
      .filter((line) => baseEnvPattern.test(line) && line.includes(".replace(/\\/+$/, '')"));
    assert.deepEqual(unguarded, [], `${file} خط ناگارد دارد:\n${unguarded.join('\n')}`);
  }
});

test('آدرس پیش‌فرض اینستاگرام پذیرفته می‌شود و آلودگی env رد می‌شود', () => {
  assert.equal(
    assertSafeApiBase('https://graph.facebook.com/v21.0', { envName: 'INSTAGRAM_GRAPH_BASE' }),
    'https://graph.facebook.com/v21.0',
  );
  assert.throws(
    () => assertSafeApiBase('http://169.254.169.254/v21.0', { envName: 'INSTAGRAM_GRAPH_BASE' }),
    (error) => error?.code === INSECURE_BASE_CODE,
  );
});

/* ── ۵) استثنای صریح توسعهٔ محلی ───────────────────────────────────────── */

test('استثنا فقط با env صریح کار می‌کند و پیش‌فرض بسته است', () => {
  withEnv(ALLOW_PRIVATE_BASE_ENV, undefined, () => {
    assert.equal(privateBaseAllowed(), false);
    assert.throws(() => assertSafeApiBase('http://127.0.0.1:8080', { envName: 'X' }));
  });

  withEnv(ALLOW_PRIVATE_BASE_ENV, '1', () => {
    assert.equal(privateBaseAllowed(), true);
    assert.equal(assertSafeApiBase('http://127.0.0.1:8080', { envName: 'X' }), 'http://127.0.0.1:8080');
  });

  /* مقدارهای دیگر استثنا را فعال نمی‌کنند */
  withEnv(ALLOW_PRIVATE_BASE_ENV, 'yes-please', () => {
    assert.equal(privateBaseAllowed(), false);
  });
});
