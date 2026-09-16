/*
 * پاس دوم مهاجرت رنگ: تبدیل rgba(r, g, b, a) به توکن‌های آلفا.
 *
 * ⚠️⚠️  این اسکریپت **قبلاً روی کل پروژه اجرا شده است**.  ⚠️⚠️
 * اجرای دوبارهٔ آن روی کدِ مهاجرت‌شده مخرب است. برای بررسی سلامت،
 * `scripts/theme-verify.mjs` را بزن.
 *
 * پاس اول (theme-migrate.mjs) هگزها و rgb(... / a) را گرفت. این پاس فقط
 * rgba(...) های باقی‌مانده را می‌گیرد:
 *
 *   خنثی (اشباع ≤ ۱۴):
 *     سیاه خالص (0,0,0)          → rgb(var(--shadow-rgb) / a)
 *         پردهٔ پشت مودال، سایه، روکش تیره‌کنندهٔ تصویر — باید در هر دو تم تیره بماند.
 *     خاکستری تیره (L < ۱۲۸)     → rgb(var(--scrim-rgb) / a)  ← «سطح»؛ در تم روشن سفید می‌شود
 *     خاکستری روشن (L ≥ ۱۲۸)     → rgb(var(--wash-rgb) / a)   ← تینت ملایم
 *     مرز (border/outline)       → rgb(var(--line-rgb) / a)
 *     متن (color)                → rgb(var(--ink-rgb) / a)
 *     هر جا در مقدار، shadow باشد → rgb(var(--shadow-rgb) / a)  (box/drop/text-shadow)
 *
 *   رنگی:
 *     آلفا ≥ ۰٫۵ و روشنایی ≤ ۷۰  →  var(--{family}-deep)   ← پنل‌های عمیق
 *     بقیه دست‌نخورده: تینت‌های کم‌آلفا روی کارت سفید هم درست خوانده می‌شوند.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/heidarian/Documents/my own project/tapeshweb/src';

const NEUTRAL_MAX_SAT = 14;
const PANEL_MAX_LIGHTNESS = 70;
const PANEL_MIN_ALPHA = 0.5;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const lightness = (r, g, b) => (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 127 ? (d / (510 - max - min)) * 100 : (d / (max + min)) * 100;
}

function hue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/* خانوادهٔ رنگی از روی هیو — همان نگاشت اسکریپت پاس اول */
function familyOf(h) {
  if (h >= 185 && h < 250) return 'blue';
  if (h >= 250 && h < 300) return 'purple';
  if (h >= 95 && h < 175) return 'green';
  if (h >= 25 && h < 60) return 'gold';
  if (h >= 15 && h < 25) return 'copper';
  if (h < 15 || h >= 345) return 'red';
  if (h >= 60 && h < 95) return 'gold';
  return null;
}

/* نام پراپرتی جاری در CSS را از روی متن قبل از تطبیق حدس بزن */
function propertyBefore(text, index) {
  const window = text.slice(Math.max(0, index - 120), index);
  const match = window.match(/([a-zA-Z-]+)\s*:\s*[^;{}]*$/);
  return match ? match[1].toLowerCase() : '';
}

/* آیا این rgba داخل یک تابع سایه نشسته است؟ (drop-shadow/text-shadow داخل filter) */
function inShadowFunction(text, index) {
  const window = text.slice(Math.max(0, index - 60), index);
  return /(drop-shadow|text-shadow|box-shadow)\s*\([^()]*$/.test(window);
}

const RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;

/* لایه‌هایی که تم تیره/روشن خودشان را دارند و نباید دست بخورند */
const SKIP_FILES = new Set(['layout/dashboard/courses/reference/reader/reader.css']);

function resolve(prop, r, g, b, alpha, isShadowFn) {
  const sat = saturation(r, g, b);
  const L = lightness(r, g, b);
  const isShadow = isShadowFn || prop.includes('shadow');
  const isBorder = prop.includes('border') || prop.includes('outline');
  const isText = prop === 'color' || prop === 'caret-color' || prop === 'accent-color';
  const isPureBlack = r === 0 && g === 0 && b === 0;

  if (sat <= NEUTRAL_MAX_SAT) {
    /* سیاه خالص هرگز «سطح» نیست؛ پرده/سایه است و باید در هر دو تم تیره بماند */
    if (isShadow || isPureBlack) return `rgb(var(--shadow-rgb) / ${alpha})`;
    if (isText) return `rgb(var(--ink-rgb) / ${alpha})`;
    if (isBorder) return `rgb(var(--line-rgb) / ${alpha})`;
    return L >= 128
      ? `rgb(var(--wash-rgb) / ${alpha})`
      : `rgb(var(--scrim-rgb) / ${alpha})`;
  }

  if (alpha >= PANEL_MIN_ALPHA && L <= PANEL_MAX_LIGHTNESS) {
    const family = familyOf(hue(r, g, b));
    if (family) return `var(--${family}-deep)`;
  }

  return null;
}

const report = [];
let changedFiles = 0;
let changedValues = 0;
let skippedFiles = 0;
const skipped = new Map();

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (SKIP_FILES.has(rel)) {
    skippedFiles += 1;
    continue;
  }

  const original = fs.readFileSync(file, 'utf8');
  let touched = false;

  const next = original.replace(RE, (full, r, g, b, a, offset) => {
    const prop = propertyBefore(original, offset);
    const shadowFn = inShadowFunction(original, offset);
    const replacement = resolve(prop, Number(r), Number(g), Number(b), a, shadowFn);

    if (!replacement) {
      const key = `${prop || '(?)'} ${full}`;
      skipped.set(key, (skipped.get(key) ?? 0) + 1);
      return full;
    }

    touched = true;
    changedValues += 1;
    report.push(`${rel}  ${prop}: ${full}  →  ${replacement}`);
    return replacement;
  });

  if (touched) {
    fs.writeFileSync(file, next);
    changedFiles += 1;
  }
}

console.log(`files changed:  ${changedFiles}`);
console.log(`files skipped:  ${skippedFiles}`);
console.log(`values changed: ${changedValues}`);
console.log(`kept as-is:     ${[...skipped.values()].reduce((a, b) => a + b, 0)}`);
console.log('\n── intentionally kept (chromatic low-alpha tints) ──');
const kept = [...skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
for (const [key, count] of kept) console.log(`${String(count).padStart(3)}  ${key}`);

fs.writeFileSync(
  '/Users/heidarian/Documents/my own project/tapeshweb/scripts/rgba-report.txt',
  report.join('\n'),
);
console.log('\nfull log → scripts/rgba-report.txt');
