/*
 * تست تاب‌آوری فراخوانی سرویس‌های بیرونی انتشار — فاز ۱۰.
 *
 * مسئلهٔ اثبات‌شده: آداپتورهای انتشار فقط «مهلت» داشتند. هیچ حالتی از
 * «این سرویس الان خراب است» نگه داشته نمی‌شد و هیچ تلاش مجددی وجود نداشت؛
 * پس هر انتشار بعدی هم مستقل به سرویس مرده می‌کوبید.
 *
 * این فایل اثبات می‌کند:
 *   ۱) تفکیک «خطای گذرا» از «خطای قطعی» درست است (۴۰۳ نباید تکرار شود).
 *   ۲) تلاش مجدد فقط روی گذراها کار می‌کند و سقف دارد.
 *   ۳) مدارشکن پس از آستانه باز می‌شود، سریع شکست می‌دهد، و پس از سردشدن
 *      یک «کاوش» می‌دهد؛ موفقیت مدار را می‌بندد.
 *   ۴) خطای قطعی مدار را باز نمی‌کند (توکن باطل = سرویس خراب نیست).
 *   ۵) کد خطای جدیدی ساخته نشده — مدار باز همان `PUBLISH_UNREACHABLE` است،
 *      چون جدول قرارداد API قفل شده و نباید عوض شود.
 *
 * اجرا: `node --test database/publisherResilience.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const {
  CIRCUIT_OPEN_FLAG,
  createCircuitBreaker,
  guardedCall,
  isTransient,
  withRetry,
} = await import('./publishers/resilience.js');

const { ADMIN_STATUS_BY_CODE } = await import('./apiContract/errorModel.js');

const platformError = (code, httpStatus) => Object.assign(new Error(code), { code, httpStatus });

/* ─────────────────────── ۱. تفکیک گذرا از قطعی ─────────────────────── */

test('۱. خطاهای گذرا (۴۲۹/۵xx/مهلت/قطع ارتباط) گذرا شمرده می‌شوند', () => {
  for (const status of [429, 500, 502, 503, 504]) {
    assert.equal(isTransient(platformError('PUBLISH_FAILED', status)), true, `وضعیت ${status}`);
  }

  for (const code of ['PUBLISH_TIMEOUT', 'PUBLISH_UNREACHABLE', 'PUBLISH_FAILED']) {
    assert.equal(isTransient(platformError(code)), true, `کد ${code}`);
  }
});

test('۲. خطاهای قطعی هرگز گذرا شمرده نمی‌شوند (تکرارشان فقط تأخیر است)', () => {
  for (const status of [400, 401, 403, 404, 409, 413, 415]) {
    assert.equal(isTransient(platformError('PUBLISH_FAILED', status)), false, `وضعیت ${status}`);
  }

  for (const code of ['PUBLISH_NO_TOKEN', 'PUBLISH_UNAUTHORIZED', 'PUBLISH_FORBIDDEN', 'VALIDATION_ERROR']) {
    assert.equal(isTransient(platformError(code)), false, `کد ${code}`);
  }

  assert.equal(isTransient(null), false);
  assert.equal(isTransient(undefined), false);
});

/* ─────────────────────────── ۳. تلاش مجدد ─────────────────────────── */

test('۳. تلاش مجدد روی گذراها تا سقف ادامه می‌دهد و در نهایت خطا را می‌دهد', async () => {
  let calls = 0;
  const delays = [];

  await assert.rejects(
    withRetry(async () => { calls += 1; throw platformError('PUBLISH_TIMEOUT'); }, {
      attempts: 3,
      sleep: async (ms) => { delays.push(ms); },
    }),
    /PUBLISH_TIMEOUT/,
  );

  assert.equal(calls, 3, 'باید دقیقاً سه بار تلاش شود');
  assert.deepEqual(delays, [400, 800], 'backoff نمایی بین تلاش‌ها');
});

test('۴. تلاش مجدد روی خطای قطعی اصلاً تکرار نمی‌کند', async () => {
  let calls = 0;

  await assert.rejects(
    withRetry(async () => { calls += 1; throw platformError('PUBLISH_FORBIDDEN', 403); }, {
      attempts: 5,
      sleep: async () => { throw new Error('نباید خواب برود'); },
    }),
    /PUBLISH_FORBIDDEN/,
  );

  assert.equal(calls, 1, 'خطای قطعی باید فوراً برگردد');
});

test('۵. تلاش مجدد موفق، مقدار را برمی‌گرداند و بی‌دلیل تکرار نمی‌کند', async () => {
  let calls = 0;
  const value = await withRetry(async () => { calls += 1; return 'ok'; }, { attempts: 3 });
  assert.equal(value, 'ok');
  assert.equal(calls, 1);
});

/* ─────────────────────────── ۴. مدارشکن ─────────────────────────── */

test('۶. مدارشکن پس از آستانه باز می‌شود و سریع شکست می‌دهد', async () => {
  let clock = 1_000;
  const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 10_000, now: () => clock });

  let attempts = 0;
  const run = async () => { attempts += 1; throw platformError('PUBLISH_UNREACHABLE'); };

  for (let index = 0; index < 3; index += 1) {
    await assert.rejects(guardedCall('send:demo', { run, breaker, retry: { attempts: 1 } }));
  }
  assert.equal(attempts, 3);
  assert.equal(breaker.snapshot('send:demo').open, true);

  /* اکنون دروازه باید بدون تماس با سرویس ببندد */
  await assert.rejects(
    guardedCall('send:demo', { run, breaker, retry: { attempts: 1 } }),
    (error) => {
      assert.equal(error[CIRCUIT_OPEN_FLAG], true, 'پرچم مدار باز باید ست باشد');
      assert.equal(error.code, 'PUBLISH_UNREACHABLE', 'کد جدید ساخته نشده');
      assert.equal(typeof error.retryAfterMs, 'number');
      return true;
    },
  );
  assert.equal(attempts, 3, 'در حالت مدار باز هیچ فراخوانی‌ای به سرویس نمی‌رود');
});

test('۷. پس از سردشدن، یک کاوش مجاز است و موفقیت مدار را می‌بندد', async () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 5_000, now: () => clock });

  const fail = async () => { throw platformError('PUBLISH_TIMEOUT'); };
  await assert.rejects(guardedCall('send:x', { run: fail, breaker, retry: { attempts: 1 } }));
  await assert.rejects(guardedCall('send:x', { run: fail, breaker, retry: { attempts: 1 } }));
  assert.equal(breaker.snapshot('send:x').open, true);

  /* پیش از پایان سردشدن: بسته است */
  clock = 4_999;
  await assert.rejects(
    guardedCall('send:x', { run: async () => 'never', breaker, retry: { attempts: 1 } }),
    (error) => error[CIRCUIT_OPEN_FLAG] === true,
  );

  /* پس از سردشدن: یک کاوش موفق ⇒ مدار بسته */
  clock = 5_000;
  const value = await guardedCall('send:x', { run: async () => 'sent', breaker, retry: { attempts: 1 } });
  assert.equal(value, 'sent');
  assert.equal(breaker.snapshot('send:x').open, false);
  assert.equal(breaker.snapshot('send:x').failures, 0);
});

test('۸. خطای قطعی (۴۰۳) مدار را باز نمی‌کند — سرویس خراب نیست، دسترسی نیست', async () => {
  const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000 });

  for (let index = 0; index < 5; index += 1) {
    await assert.rejects(guardedCall('send:y', {
      run: async () => { throw platformError('PUBLISH_FORBIDDEN', 403); },
      breaker,
      retry: { attempts: 1 },
    }));
  }

  assert.equal(breaker.snapshot('send:y').open, false, '۴۰۳ نباید مدار را باز کند');
  assert.equal(breaker.snapshot('send:y').failures, 0);
});

test('۹. کلیدهای مستقل جدا شمرده می‌شوند (خرابی یک پلتفرم بقیه را نمی‌بندد)', async () => {
  const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000 });

  const boom = async () => { throw platformError('PUBLISH_UNREACHABLE'); };
  await assert.rejects(guardedCall('send:a', { run: boom, breaker, retry: { attempts: 1 } }));
  await assert.rejects(guardedCall('send:a', { run: boom, breaker, retry: { attempts: 1 } }));

  assert.equal(breaker.snapshot('send:a').open, true);
  assert.equal(breaker.snapshot('send:b').open, false);
  assert.equal(await guardedCall('send:b', { run: async () => 'fine', breaker, retry: { attempts: 1 } }), 'fine');
});

/* ────────────────── ۵. قفل قرارداد: کد خطای جدید اضافه نشده ────────────────── */

test('۱۰. مدار باز کد جدیدی به قرارداد API اضافه نمی‌کند', () => {
  const locked = {
    PUBLISH_NO_TOKEN: 409, PUBLISH_UNAUTHORIZED: 502, PUBLISH_FORBIDDEN: 502,
    PUBLISH_UNREACHABLE: 502, PUBLISH_TIMEOUT: 504, PUBLISH_FAILED: 502,
  };

  for (const [code, status] of Object.entries(locked)) {
    assert.equal(ADMIN_STATUS_BY_CODE[code], status, `وضعیت ${code} نباید عوض شود`);
  }

  /* هیچ کد `PUBLISH_CIRCUIT_*` نباید وجود داشته باشد */
  assert.equal(
    Object.keys(ADMIN_STATUS_BY_CODE).some((code) => code.startsWith('PUBLISH_CIRCUIT')),
    false,
    'کد خطای جدید ساخته نشده باشد',
  );

  const source = readFileSync(resolve(HERE, 'publishers/resilience.js'), 'utf8');
  assert.equal(source.includes('PUBLISH_CIRCUIT'), false, 'سورس هم نباید کد جدید بسازد');
});

/* ────────────────── ۶. رگرسیون: رفتار بیرونی رجیستری دست‌نخورده ────────────────── */

test('۱۱. پلتفرم پشتیبانی‌نشده همچنان همان خطای قراردادی را می‌دهد', async () => {
  const { sendPlatform, platformMetrics, platformCircuitStatus } = await import('./publishers/index.js');

  await assert.rejects(
    sendPlatform({ platform: 'not-a-platform', token: 't', target: 'x', text: 'hi' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );

  /* سنجهٔ پلتفرم ناشناخته ⇒ null، بدون پرتاب */
  assert.equal(await platformMetrics({ platform: 'not-a-platform', token: 't', target: 'x' }), null);

  /* وضعیت مدار تازه بسته است */
  assert.deepEqual(platformCircuitStatus('not-a-platform'), { open: false, failures: 0, retryAfterMs: 0 });
});

test('۱۲. ارسال «حداکثر یک‌بار» است: بدون درخواست صریح، تکرار نمی‌شود', () => {
  const source = readFileSync(resolve(HERE, 'publishers/index.js'), 'utf8');

  /* شاهد کد: پیش‌فرض `attempts: 1` و روشن‌شدن فقط با `options.retry === true` */
  assert.match(source, /attempts:\s*options\?\.retry === true \? 2 : 1/);

  /* و `send` باید از دروازهٔ مدارشکن بگذرد */
  assert.match(source, /guardedCall\(`send:\$\{platform\}`/);
});
