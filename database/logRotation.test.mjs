/*
 * آزمون لاگ پایدار و چرخش آن — فاز ۹ (مشاهده‌پذیری).
 *
 * چه چیزی را اثبات می‌کند:
 *   • بدون `TAPESH_LOG_FILE` هیچ فایل لاگی ساخته نمی‌شود (رفتار فعلی دست‌نخورده).
 *   • با تنظیم آن، هر خط روی دیسک می‌نشیند.
 *   • با گذر از سقف حجم، فایل چرخش می‌کند و تعداد نسخه‌ها از `TAPESH_LOG_KEEP`
 *     بیشتر نمی‌شود (یعنی دیسک بی‌نهایت رشد نمی‌کند).
 *   • پوشهٔ والد در صورت نبود ساخته می‌شود.
 *   • خطای نوشتن (مسیر غیرقابل‌نوشتن) درخواست را نمی‌شکند و `false` برمی‌گرداند.
 *
 * اجرا: `node --test database/logRotation.test.mjs`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendLogLine, logFileTarget } from './observability.js';

function sandbox() {
  return mkdtempSync(join(tmpdir(), 'tapesh-log-'));
}

test('بدون TAPESH_LOG_FILE هیچ هدفی وجود ندارد و هیچ فایلی نوشته نمی‌شود', () => {
  const dir = sandbox();
  try {
    assert.equal(logFileTarget({}), null);
    assert.equal(appendLogLine('{"a":1}', {}), false);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('با TAPESH_LOG_FILE خط روی دیسک می‌نشیند و پوشهٔ والد ساخته می‌شود', () => {
  const dir = sandbox();
  try {
    const file = join(dir, 'nested', 'access.log');
    const env = { TAPESH_LOG_FILE: file };

    assert.equal(appendLogLine('{"reqId":"a"}', env), true);
    assert.equal(appendLogLine('{"reqId":"b"}', env), true);

    const lines = readFileSync(file, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], '{"reqId":"a"}');
    assert.equal(lines[1], '{"reqId":"b"}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('گذر از سقف حجم ⇒ چرخش، و تعداد نسخه‌ها از keep بیشتر نمی‌شود', () => {
  const dir = sandbox();
  try {
    const file = join(dir, 'access.log');
    const env = { TAPESH_LOG_FILE: file, TAPESH_LOG_MAX_BYTES: '64', TAPESH_LOG_KEEP: '2' };

    for (let index = 0; index < 40; index += 1) {
      appendLogLine(`{"reqId":"${index}","padding":"${'x'.repeat(20)}"}`, env);
    }

    const files = readdirSync(dir).sort();
    assert.ok(files.includes('access.log'), 'فایل جاری باید بماند');
    assert.ok(files.includes('access.log.1'), 'نسخهٔ چرخش‌خوردهٔ ۱ باید باشد');
    assert.ok(files.includes('access.log.2'), 'نسخهٔ چرخش‌خوردهٔ ۲ باید باشد');
    assert.equal(files.includes('access.log.3'), false, 'keep=2 یعنی نسخهٔ سوم نباید ساخته شود');

    const current = readFileSync(file, 'utf8');
    assert.ok(current.length > 0, 'فایل جاری نباید خالی بماند');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('خطای نوشتن (مسیر غیرقابل‌نوشتن) درخواست را نمی‌شکند', () => {
  const dir = sandbox();
  try {
    /* «فایل» والد یک فایل معمولی است ⇒ mkdir زیر آن قطعاً شکست می‌خورد */
    const blocker = join(dir, 'blocker');
    writeFileSync(blocker, 'not a directory');

    const env = { TAPESH_LOG_FILE: join(blocker, 'sub', 'access.log') };
    assert.equal(appendLogLine('{"reqId":"x"}', env), false);
    assert.equal(existsSync(join(blocker, 'sub')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
