/*
 * theme-scripts.test.mjs — قفل رگرسیون برای دو اسکریپت تم (PHASE 19/20).
 *
 * چرا وجود دارد: هر دو اسکریپت به `src/styles.css` قفل بودند، در حالی که آن
 * فایل پس از بازآرایی فقط زنجیرهٔ `@import` است و توکن‌ها در
 * `src/styles/tokens.css` زندگی می‌کنند. نتیجه:
 *   • `theme-contrast.mjs` ⇒ صفر جفت سنجیده و **«۰ ایراد» با کد خروج ۰** (سبزِ کاذب)
 *   • `theme-verify.mjs`   ⇒ ۱۰۹ «توکن گم‌شده» و کد خروج ۱ (شکستِ کاذب)
 *
 * این تست سه چیز را قفل می‌کند:
 *   ۱. اسکریپت‌ها روی درخت واقعی، **سنجش واقعی** انجام می‌دهند (نه صفر بررسی).
 *   ۲. زنجیرهٔ `@import` واقعاً باز می‌شود (CSS توکن‌دار در فایل ایمپورت‌شده).
 *   ۳. گاردِ سبزِ کاذب با CSS بدون توکن **fail-closed** است (کد خروج ۲).
 *
 * اجرا: node --test scripts/theme-scripts.test.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const NODE = process.execPath;

function run(script, args = [], cwd = ROOT) {
  const result = spawnSync(NODE, [join(HERE, script), ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    code: result.status ?? -1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

/* ── ۱. theme-contrast روی درخت واقعی: سنجش واقعی، نه سبزِ کاذب ── */
test('theme-contrast واقعاً جفت‌ها را می‌سنجد و سبزِ کاذب نیست', () => {
  const { code, output } = run('theme-contrast.mjs');
  assert.equal(code, 0, `انتظار کد خروج ۰؛ خروجی:\n${output}`);

  const measured = [...output.matchAll(/\d+\.\d+:1/g)].length;
  assert.ok(
    measured >= 40,
    `انتظار ≥۴۰ نسبت سنجیده‌شده، ${measured} پیدا شد — یعنی اسکریپت توکن‌ها را نمی‌خواند`,
  );
  assert.ok(
    !output.includes('بررسی نشد'),
    'هیچ جفتی نباید «بررسی نشد» بماند — این نشانهٔ خوانده‌نشدن توکن‌هاست',
  );
});

/* ── ۲. theme-verify روی درخت واقعی: توکن‌ها از زنجیرهٔ import پیدا می‌شوند ── */
test('theme-verify توکن‌های جهانی را از زنجیرهٔ import پیدا می‌کند', () => {
  const { code, output } = run('theme-verify.mjs');
  assert.equal(code, 0, `انتظار کد خروج ۰؛ خروجی:\n${output}`);
  assert.match(output, /all 60 global tokens defined in :root/);
  assert.match(output, /all good/);
});

/* ── ۳. زنجیرهٔ import در درخت موقت واقعاً باز می‌شود ── */
test('زنجیرهٔ @import باز می‌شود: توکن در فایل ایمپورت‌شده سنجیده می‌شود', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tapesh-theme-import-'));
  try {
    mkdirSync(join(dir, 'src/styles'), { recursive: true });
    writeFileSync(join(dir, 'src/styles.css'), "@import './styles/tokens.css';\n");
    writeFileSync(
      join(dir, 'src/styles/tokens.css'),
      [
        ':root {',
        '  --white: #ffffff;',
        '  --background: #000000;',
        '  --surface: #000000;',
        '  --deep: #000000;',
        '  --surface-soft: #000000;',
        '}',
        ":root[data-theme='light'] {",
        '  --white: #000000;',
        '  --background: #ffffff;',
        '}',
        '* {',
        '',
      ].join('\n'),
    );

    const { code, output } = run('theme-contrast.mjs', [`--root=${dir}`]);
    assert.equal(code, 0, `انتظار کد خروج ۰؛ خروجی:\n${output}`);

    /* سفید روی سیاه = ۲۱:۱ — اگر زنجیره باز نشود، هیچ نسبتی چاپ نمی‌شود */
    assert.match(output, /21\.00:1/, `نسبت محاسبه‌شده پیدا نشد؛ خروجی:\n${output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ── ۴. گارد سبزِ کاذب: CSS بدون توکن ⇒ fail-closed با کد ۲ ── */
test('CSS بدون توکن هگزی ⇒ گارد fail-closed با کد خروج ۲', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tapesh-theme-empty-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src/styles.css'), "body { color: red; }\n");

    const { code, output } = run('theme-contrast.mjs', [`--root=${dir}`]);
    assert.equal(code, 2, `انتظار کد خروج ۲ (fail-closed)؛ خروجی:\n${output}`);
    assert.match(output, /هیچ توکن هگزی/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
