/*
 * contrast-audit — خوانایی پالت در هر دو تم.
 *
 * توکن‌ها را از styles.css می‌خواند و نسبت کنتراست WCAG جفت‌های
 * «متن روی سطح» را حساب می‌کند. هدف: در تم روشن هیچ متنی ناخوانا نماند.
 *
 * اجرا: node scripts/theme-contrast.mjs [--root=DIR]
 */
import fs from 'node:fs';
import path from 'node:path';

/*
 * `--root=DIR` برای تست خودکار: اجازه می‌دهد اسکریپت روی یک درخت موقت اجرا شود
 * تا گاردِ «سبزِ کاذب» با CSS بدون توکن اثبات شود. الگو از `data-restore.mjs`.
 */
const rootArg = process.argv.slice(2).find((a) => a.startsWith('--root='));
const ROOT = rootArg
  ? path.resolve(rootArg.slice('--root='.length))
  : path.resolve(import.meta.dirname, '..');

/*
 * `src/styles.css` پس از بازآرایی به زنجیرهٔ `@import` تبدیل شد و خودش هیچ
 * توکنی ندارد. اگر فقط همان فایل خوانده شود، هیچ توکنی پیدا نمی‌شود و اسکریپت
 * بی‌صدا «۰ ایراد» برمی‌گرداند (سبزِ کاذب). پس زنجیرهٔ import را تا عمق
 * محدود باز می‌کنیم تا توکن‌های واقعی از `src/styles/tokens.css` خوانده شوند.
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

const styles = readCssWithImports(path.join(ROOT, 'src/styles.css'));

function readTokens(block) {
  const tokens = {};
  for (const m of block.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    tokens[m[1].slice(2)] = m[2].trim();
  }
  return tokens;
}

const darkStart = styles.indexOf(':root {');
const lightStart = styles.indexOf(":root[data-theme='light']");
const dark = readTokens(styles.slice(darkStart, lightStart));
const light = readTokens(styles.slice(lightStart, styles.indexOf('* {', lightStart)));

function hexToRgb(value) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/*
 * جفت‌های واقعیِ پروژه: متن روی سطحی که در همان ترکیب استفاده می‌شود.
 * سطح‌ها: background / surface / deep / *-deep (پنل‌های رنگی)
 */
const PAIRS = [
  ['متن اصلی', 'white', 'background'],
  ['متن اصلی روی کارت', 'white', 'surface'],
  ['متن روی پنل عمیق', 'white', 'deep'],
  ['متن ثانویه', 'muted', 'surface'],
  ['متن کم‌رنگ', 'faint', 'surface'],
  ['کم‌رنگ‌ترین متن', 'ghost', 'surface'],
  ['متن روی کارت هدر', 'white', 'surface-soft'],
  ['آبی متن', 'blue-ink', 'surface'],
  ['آبی متن روی پنل آبی', 'blue-ink', 'blue-deep'],
  ['سبز متن', 'green-ink', 'surface'],
  ['سبز متن روی پنل سبز', 'green-ink', 'green-deep'],
  ['بنفش متن', 'purple-ink', 'surface'],
  ['بنفش متن روی پنل بنفش', 'purple-ink', 'purple-deep'],
  ['طلایی متن', 'gold-ink', 'surface'],
  ['طلایی متن روی پنل طلایی', 'gold-ink', 'gold-deep'],
  ['قهوه‌ای متن', 'brown-ink', 'surface'],
  ['مسی متن', 'copper-ink', 'surface'],
  ['مسی متن روی پنل مسی', 'copper-ink', 'copper-deep'],
  ['قرمز متن', 'red-ink', 'surface'],
  ['قرمز متن روی پنل قرمز', 'red-ink', 'red-deep'],
  ['نارنجی متن', 'orange-ink', 'surface'],
  ['مرکب تیره روی پرکنندهٔ روشن', 'ink-deep', 'pure'],
];

function audit(themeName, tokens) {
  const rows = [];
  let fails = 0;

  for (const [label, fgKey, bgKey] of PAIRS) {
    const fgRaw = tokens[fgKey];
    const bgRaw = tokens[bgKey];

    if (!fgRaw?.startsWith('#') || !bgRaw?.startsWith('#')) {
      rows.push({ label, note: 'توکن غیر هگز — بررسی نشد' });
      continue;
    }

    const value = ratio(hexToRgb(fgRaw), hexToRgb(bgRaw));
    /* آستانهٔ WCAG AA برای متن معمولی ۴٫۵ و برای متن درشت ۳ */
    const level = value >= 4.5 ? 'AA' : value >= 3 ? 'AA-large' : 'LOW';
    if (level === 'LOW') fails += 1;
    rows.push({ label, value, level });
  }

  console.log(`\n══ ${themeName} ══`);
  for (const row of rows) {
    if (row.note) {
      console.log(`  ·  ${row.label.padEnd(32)} ${row.note}`);
      continue;
    }
    const mark = row.level === 'LOW' ? '✗' : row.level === 'AA' ? '✓' : '~';
    console.log(
      `  ${mark}  ${row.label.padEnd(32)} ${row.value.toFixed(2).padStart(5)}:1  ${row.level}`,
    );
  }
  return fails;
}

console.log('کنتراست WCAG — ✓ AA (≥۴٫۵)   ~ AA-large (≥۳)   ✗ کم');

/*
 * گارد سبزِ کاذب: اگر هیچ توکن هگزی خوانده نشود (تغییر ساختار CSS، حذف
 * توکن‌ها، شکست import)، «۰ ایراد» معنا ندارد و نباید موفق گزارش شود.
 */
const checkedTokens = [...Object.values(dark), ...Object.values(light)].filter((v) =>
  typeof v === 'string' && v.trim().startsWith('#'),
).length;
if (checkedTokens === 0) {
  console.error('\n✗ هیچ توکن هگزی از زنجیرهٔ CSS خوانده نشد — بررسی انجام نشد (نه «۰ ایراد»).');
  process.exit(2);
}

const darkFails = audit('حالت تیره', dark);
const lightFails = audit('حالت روشن', light);

console.log(`\nجمع: تیره ${darkFails} ایراد، روشن ${lightFails} ایراد`);
process.exit(darkFails + lightFails > 0 ? 1 : 0);
