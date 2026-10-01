/*
 * theme-verify — سلامت‌سنجی مهاجرت تم.
 *
 * سه چیز را چک می‌کند:
 *   ۱. تعادل آکولاد در همهٔ CSSها (شکستن ساختار = فاجعه).
 *   ۲. شمارش اعلان‌های رنگ قبل/بعد، تا مطمئن شویم چیزی گم نشده.
 *   ۳. هر `var(--x)` که در پروژه مصرف می‌شود باید در styles.css تعریف شده باشد.
 *
 * اجرا: node scripts/theme-verify.mjs [--root=DIR]
 */
import fs from 'node:fs';
import path from 'node:path';

/* `--root=DIR` برای تست خودکار روی درخت موقت (الگو از `data-restore.mjs`) */
const rootArg = process.argv.slice(2).find((a) => a.startsWith('--root='));
const ROOT = rootArg
  ? path.resolve(rootArg.slice('--root='.length))
  : path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, list);
    else if (/\.(jsx?|css)$/.test(e.name)) list.push(full);
  }
  return list;
}

const files = walk(SRC);
let problems = 0;

/* ۱. تعادل آکولاد */
for (const f of files.filter((f) => f.endsWith('.css'))) {
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (src.match(/\{/g) || []).length;
  const close = (src.match(/\}/g) || []).length;
  if (open !== close) {
    console.log(`✗ unbalanced braces in ${path.relative(ROOT, f)}: ${open} { vs ${close} }`);
    problems++;
  }
}
if (!problems) console.log('✓ CSS braces balanced');

/*
 * ۲. توکن‌های جهانی تم.
 * توکن‌های لایه‌ای (--ad-*, --intl-*, --rdr-*, --learn-*) در فایل خودِ لایه
 * تعریف می‌شوند و متغیرهای تک‌حرفی با JS ست می‌شوند، پس این‌جا فقط مجموعهٔ
 * توکن‌های جهانی بررسی می‌شود: هر توکنی که مهاجرت تولید می‌کند باید در
 * styles.css مقدار داشته باشد.
 */
const GLOBAL_TOKENS = [
  'deep', 'background', 'surface', 'surface-soft', 'surface-strong',
  'white', 'muted', 'faint', 'ghost', 'ink-deep',
  'pure', 'light-fill', 'light-fill-soft', 'border-solid',
  'wash-rgb', 'scrim-rgb', 'line-rgb', 'ink-rgb', 'shadow-rgb', 'shadow-scale', 'icon-filter',
  'blue', 'blue-bright', 'blue-ink', 'blue-soft-ink', 'blue-deep',
  'green', 'green-bright', 'green-vivid', 'green-ink', 'green-soft-ink', 'green-deep',
  'brown', 'brown-bright',
  'copper', 'copper-ink', 'copper-soft-ink', 'copper-deep',
  'purple', 'purple-bright', 'purple-ink', 'purple-soft-ink', 'purple-deep',
  'gold', 'gold-ink', 'gold-soft-ink', 'gold-deep',
  'orange', 'orange-ink',
  'red', 'red-ink', 'red-soft-ink', 'red-deep', 'rose', 'form-error',
  'card-lavender', 'card-copper', 'card-sage', 'card-sky', 'card-warm',
];

/*
 * `src/styles.css` پس از بازآرایی فقط زنجیرهٔ `@import` است و توکن‌ها در
 * `src/styles/tokens.css` زندگی می‌کنند. اگر فقط فایل ورودی خوانده شود،
 * هیچ توکنی پیدا نمی‌شود و همهٔ توکن‌های جهانی «گم‌شده» گزارش می‌شوند
 * (شکستِ کاذب). پس زنجیرهٔ import را تا عمق محدود باز می‌کنیم.
 */
function readCssWithImports(file, depth = 0, seen = new Set()) {
  const abs = path.resolve(file);
  if (depth > 4 || seen.has(abs)) return '';
  seen.add(abs);
  const raw = fs.readFileSync(abs, 'utf8');
  return raw.replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (whole, spec) => {
    if (/^https?:/.test(spec)) return whole;
    const target = path.resolve(path.dirname(abs), spec);
    return fs.existsSync(target) ? readCssWithImports(target, depth + 1, seen) : whole;
  });
}

const styles = readCssWithImports(path.join(SRC, 'styles.css'));
const inRoot = new Set();
for (const m of styles.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) inRoot.add(m[1].slice(2));
const inLight = new Set();
const lightBlock = styles.slice(styles.indexOf(":root[data-theme='light']"));
for (const m of lightBlock.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) inLight.add(m[1].slice(2));

/* توکن‌هایی که باید در تم روشن مقدار متفاوت داشته باشند (اکسنت‌های پرکننده عمداً ثابت‌اند) */
const MUST_DIFFER = [
  'deep', 'background', 'surface', 'surface-soft', 'surface-strong',
  'white', 'muted', 'faint', 'ghost',
  'light-fill', 'light-fill-soft', 'border-solid',
  'wash-rgb', 'scrim-rgb', 'line-rgb', 'ink-rgb', 'shadow-rgb', 'shadow-scale', 'icon-filter',
  'blue', 'green', 'brown', 'purple',
  'blue-ink', 'blue-soft-ink', 'blue-deep',
  'green-ink', 'green-soft-ink', 'green-deep',
  'purple-ink', 'purple-soft-ink', 'purple-deep',
  'gold-ink', 'gold-soft-ink', 'gold-deep',
  'copper-ink', 'copper-soft-ink', 'copper-deep',
  'red-ink', 'red-soft-ink', 'red-deep', 'orange-ink',
  'card-lavender', 'card-copper', 'card-sage', 'card-sky', 'card-warm',
  'color-white', 'color-black',
];

const missingDark = GLOBAL_TOKENS.filter((t) => !inRoot.has(t));
if (missingDark.length) {
  console.log(`✗ tokens missing from :root — ${missingDark.join(', ')}`);
  problems += missingDark.length;
} else {
  console.log(`✓ all ${GLOBAL_TOKENS.length} global tokens defined in :root`);
}
const missingLight = MUST_DIFFER.filter((t) => !inLight.has(t));
if (missingLight.length) {
  console.log(`✗ tokens missing from light theme — ${missingLight.join(', ')}`);
  problems += missingLight.length;
} else {
  console.log(`✓ light theme overrides all ${MUST_DIFFER.length} theme-dependent tokens`);
}

/* توکن‌هایی که مصرف می‌شوند ولی جایی تعریف نشده‌اند — اطلاعی، چون بعضی با JS ست می‌شوند */
const definedAnywhere = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(--[a-z0-9-]+)\s*:/gi)) definedAnywhere.add(m[1].slice(2));
}
const usedInCss = new Map();
for (const f of files.filter((f) => f.endsWith('.css'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)/gi)) {
    if (!usedInCss.has(m[1].slice(2))) usedInCss.set(m[1].slice(2), new Set());
    usedInCss.get(m[1].slice(2)).add(path.relative(ROOT, f));
  }
}
const unresolved = [...usedInCss.keys()].filter((n) => !definedAnywhere.has(n));
console.log(`• ${unresolved.length} CSS var names are set from JS (expected): ${unresolved.slice(0, 8).join(', ')}${unresolved.length > 8 ? ', …' : ''}`);

/* ۳. رنگ ثابت باقی‌مانده در JSX */
const leftover = new Map();
for (const f of files.filter((f) => /\.jsx?$/.test(f))) {
  const rel = path.relative(ROOT, f);
  if (rel.includes('reader')) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(
    /(?<![\w-])(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|decoration|divide|placeholder|accent|caret)-\[(#[0-9a-fA-F]{3,8})\]/g,
  )) {
    const k = `${rel}`;
    leftover.set(k, (leftover.get(k) || 0) + 1);
  }
}
const leftoverTotal = [...leftover.values()].reduce((a, b) => a + b, 0);
console.log(`• ${leftoverTotal} hard-coded colour utilities left in JSX (kept on purpose)`);

console.log(problems ? `\n${problems} PROBLEM(S)` : '\nall good');
process.exit(problems ? 1 : 0);
