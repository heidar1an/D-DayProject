/*
 * تست هم‌زمانی و lost update — فاز ۳.
 *
 * این تست **حساسیت** دارد: اول ثابت می‌کند الگوی سادهٔ
 * `read → await → write` واقعاً update گم می‌کند، بعد ثابت می‌کند همان الگو با
 * `mutateJsonFile` هیچ updateی گم نمی‌کند. اگر روزی کسی قفل را بردارد، بخش دوم
 * می‌شکند — یعنی تست بی‌فایدهٔ تشریفاتی نیست.
 *
 * سه سطح پوشش:
 *   ۱. درون-پروسه (async).
 *   ۲. بین-پروسه (چند پروسهٔ نود واقعی روی یک فایل).
 *   ۳. تشخیص خرابی و نوشتن بیرونی.
 *
 * اجرا: node --test database/concurrency.test.mjs
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { fileRevision, mutateJsonFile, resetWriteQueueStats, withFileLock, writeQueueStats } from './writeQueue.js';

const WRITE_QUEUE_URL = resolve(import.meta.dirname, 'writeQueue.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tempFile(name = 'counter.json') {
  const dir = mkdtempSync(join(tmpdir(), 'tapesh-concurrency-'));
  return { dir, file: join(dir, name) };
}

/* پاک‌سازی «بهترین‌تلاش»: گارد حذف سندباکس نباید تست را بکشد. */
function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* پاک‌نشدنِ فایل موقت، شرط درستیِ نتیجه نیست */
  }
}

/* ───────────── ۱. اثبات حساسیت: الگوی ساده update گم می‌کند ───────────── */

test('حساسیت: read→await→write بدون قفل، update گم می‌کند', async () => {
  const { dir, file } = tempFile('naive.json');
  writeFileSync(file, JSON.stringify({ value: 0 }), 'utf8');

  const naiveIncrement = async () => {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    await sleep(4); /* همان پنجرهٔ واقعی: await بین خواندن و نوشتن */
    data.value += 1;
    writeFileSync(file, JSON.stringify(data), 'utf8');
  };

  await Promise.all(Array.from({ length: 10 }, naiveIncrement));
  const final = JSON.parse(readFileSync(file, 'utf8')).value;

  assert.ok(final < 10, `الگوی ساده باید update گم کند؛ مقدار نهایی ${final} بود (انتظار < ۱۰)`);
  cleanup(dir);
});

/* ───────────── ۲. قفل درون-پروسه: هیچ updateی گم نمی‌شود ───────────── */

test('mutateJsonFile درون-پروسه: ۵۰ افزایش هم‌زمان ⇒ دقیقاً ۵۰', async () => {
  const { dir, file } = tempFile();
  writeFileSync(file, JSON.stringify({ value: 0 }), 'utf8');
  resetWriteQueueStats();

  await Promise.all(
    Array.from({ length: 50 }, () =>
      mutateJsonFile(file, async (current) => {
        await sleep(1); /* پنجرهٔ عمدی بین خواندن و نوشتن */
        return { value: current.value + 1 };
      }),
    ),
  );

  const final = JSON.parse(readFileSync(file, 'utf8')).value;
  assert.equal(final, 50, 'هیچ updateی نباید گم شود');
  assert.equal(writeQueueStats().completed, 50);
  cleanup(dir);
});

test('withFileLock ترتیب FIFO را حفظ می‌کند', async () => {
  const { dir, file } = tempFile('order.json');
  const order = [];

  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      withFileLock(file, async () => {
        order.push(index);
      }),
    ),
  );

  assert.deepEqual(order, Array.from({ length: 12 }, (_, index) => index));
  cleanup(dir);
});

/* ───────────── ۳. قفل بین-پروسه: چند پروسهٔ نود واقعی ───────────── */

test('mutateJsonFile بین-پروسه: ۵ پروسه × ۲۰ افزایش ⇒ دقیقاً ۱۰۰', async (t) => {
  const { dir, file } = tempFile('multiprocess.json');
  writeFileSync(file, JSON.stringify({ value: 0 }), 'utf8');

  const workerCode = `
import { mutateJsonFile } from ${JSON.stringify(WRITE_QUEUE_URL)};
const file = process.env.TAPESH_TEST_TARGET;
for (let i = 0; i < 20; i += 1) {
  await mutateJsonFile(file, (current) => ({ value: current.value + 1 }), { timeoutMs: 30000 });
}
`;

  const children = Array.from({ length: 5 }, () =>
    spawn(process.execPath, ['--input-type=module', '-e', workerCode], {
      env: { ...process.env, TAPESH_TEST_TARGET: file },
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );

  t.after(() => {
    for (const child of children) child.kill('SIGKILL');
  });

  const results = await Promise.all(
    children.map(
      (child) =>
        new Promise((resolvePromise) => {
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
          });
          child.on('exit', (code) => resolvePromise({ code, stderr }));
        }),
    ),
  );

  const failed = results.filter((row) => row.code !== 0);
  assert.equal(failed.length, 0, `پروسهٔ فرزند شکست خورد: ${failed.map((f) => f.stderr.slice(0, 300)).join(' | ')}`);

  const final = JSON.parse(readFileSync(file, 'utf8')).value;
  assert.equal(final, 100, 'بین ۵ پروسه هیچ updateی نباید گم شود');
  cleanup(dir);
});

/* ───────────── ۴. تشخیص خرابی و نوشتن بیرونی ───────────── */

test('فایل خراب: نوشتن انجام نمی‌شود و خطا پرتاب می‌شود', async () => {
  const { dir, file } = tempFile('corrupt.json');
  const broken = '{"value": 1,,,';
  writeFileSync(file, broken, 'utf8');

  await assert.rejects(() => mutateJsonFile(file, () => ({ value: 2 })));
  assert.equal(readFileSync(file, 'utf8'), broken, 'فایل خراب نباید بازنویسی شود');
  cleanup(dir);
});

test('نوشتن بیرونی بین خواندن و نوشتن ⇒ LOST_UPDATE_DETECTED', async () => {
  const { dir, file } = tempFile('external.json');
  writeFileSync(file, JSON.stringify({ value: 1 }), 'utf8');

  await assert.rejects(
    () =>
      mutateJsonFile(file, async (current) => {
        /* نویسندهٔ بیرونی (پروسهٔ دیگر/ابزار نگهداری) وسط کار می‌نویسد */
        writeFileSync(file, JSON.stringify({ value: 99 }), 'utf8');
        return { value: current.value + 1 };
      }),
    (error) => error.code === 'LOST_UPDATE_DETECTED',
  );

  assert.equal(JSON.parse(readFileSync(file, 'utf8')).value, 99, 'نوشتن بیرونی نباید پاک شود');
  cleanup(dir);
});

test('mutator با مقدار undefined ⇒ نوشتن انجام نمی‌شود', async () => {
  const { dir, file } = tempFile('noop.json');
  writeFileSync(file, JSON.stringify({ value: 7 }), 'utf8');
  const before = fileRevision(file);

  const result = await mutateJsonFile(file, () => undefined);
  assert.deepEqual(result, { value: 7 });
  assert.equal(fileRevision(file), before);
  cleanup(dir);
});

test('فایل ناموجود ⇒ fallback استفاده می‌شود و فایل ساخته می‌شود', async () => {
  const { dir, file } = tempFile('fresh.json');
  assert.equal(existsSync(file), false);

  await mutateJsonFile(file, (current) => ({ value: current.value + 1 }), { fallback: { value: 0 } });
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).value, 1);
  cleanup(dir);
});
