/*
 * theme-migrate — مهاجرت یکبارهٔ رنگ‌های ثابت پروژه به توکن‌های تم.
 *
 * ⚠️⚠️  این اسکریپت **قبلاً روی کل پروژه اجرا شده است**.  ⚠️⚠️
 * اجرای دوبارهٔ آن روی کدِ مهاجرت‌شده مخرب است (توکن‌ها را دوباره می‌نویسد).
 * اگر لازم شد دوباره اجرا شود، اول از `src/` بکاپ بگیر و فقط روی نسخهٔ
 * مهاجرت‌نشده اجرا کن. برای بررسی سلامت، `scripts/theme-verify.mjs` را بزن.
 *
 * چرا: حالت روشن فقط وقتی یکپارچه می‌شود که هیچ رنگ ثابتی در لایه‌ها نماند.
 * این اسکریپت همان کاری را می‌کند که دستی غیرقابل‌انجام است: هر رنگ خنثی را
 * به نزدیک‌ترین توکن معنایی (`--background`, `--white`, `--faint`, ...) و هر
 * رنگ اکسنت را در «بافت متن» به توکن `-ink` همان خانواده تبدیل می‌کند.
 *
 * قاعدهٔ بافت (context):
 *   ink  → color / fill / stroke / caret / placeholder / decoration
 *   line → border / outline / ring / divide
 *   wash → background / gradient / shadow
 * همان رنگ در بافت متن باید در تم روشن تیره شود، ولی در بافت پرکننده ثابت بماند.
 *
 * اجرا:  node scripts/theme-migrate.mjs [--dry]
 * خروجی گزارش: scripts/theme-report.txt
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const DRY = process.argv.includes('--dry');

/* فایل‌هایی که تم مستقل خودشان را دارند و نباید دست بخورند */
const SKIP_FILES = new Set(['src/layout/dashboard/courses/reference/reader/reader.css']);

/*
 * توکن‌های مرجع خودِ تم. تعریف خودشان هرگز مهاجرت نمی‌شود، وگرنه
 * `--blue: var(--blue)` می‌شود و حلقهٔ بی‌پایان CSS می‌سازد.
 */
const CANONICAL = new Set([
  'background', 'surface', 'surface-soft', 'surface-strong', 'deep', 'pure',
  'white', 'muted', 'faint', 'ghost', 'ink-deep', 'light-fill', 'light-fill-soft',
  'border-solid', 'wash-rgb', 'line-rgb', 'ink-rgb', 'shadow-rgb', 'shadow-scale',
  'icon-filter', 'content-width',
  'blue', 'blue-bright', 'blue-ink', 'blue-soft-ink', 'blue-deep',
  'green', 'green-bright', 'green-vivid', 'green-ink', 'green-soft-ink', 'green-deep',
  'brown', 'brown-bright',
  'copper', 'copper-ink', 'copper-soft-ink', 'copper-deep',
  'purple', 'purple-bright', 'purple-ink', 'purple-soft-ink', 'purple-deep',
  'gold', 'gold-ink', 'gold-soft-ink', 'gold-deep',
  'orange', 'orange-ink', 'red', 'red-ink', 'red-soft-ink', 'red-deep',
  'rose', 'form-error',
  'card-lavender', 'card-copper', 'card-sage', 'card-sky', 'card-warm',
]);

/* ───────────────────────────── رنگ‌سنجی ───────────────────────────── */

function parseHex(hex) {
  let s = hex.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length === 8) s = s.slice(0, 6);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/* «روشنی» در فضای sRGB — همان چیزی که چشم روی صفحه می‌بیند */
function lightness([r, g, b]) {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

function saturation([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === 0) return 0;
  return ((mx - mn) / mx) * 100;
}

function hueOf([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h;
  if (mx === r) h = ((g - b) / (mx - mn)) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  return (h * 60 + 360) % 360;
}

/* ───────────────────────────── نگاشت صریح ───────────────────────────── */
/* رنگ‌های پالت پروژه که باید دقیقاً به توکن نام‌دار خودشان بروند. */
const EXPLICIT = {
  '#2e4b75': { wash: '--blue', ink: '--blue', line: '--blue' },
  '#5b8cc7': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#78afe9': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#709ccb': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#5b91cb': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#9cc0e8': { wash: '--blue-bright', ink: '--blue-soft-ink', line: '--blue-bright' },
  '#465c4d': { wash: '--green', ink: '--green', line: '--green' },
  '#77b787': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#61d192': { wash: '--green-vivid', ink: '--green-ink', line: '--green-vivid' },
  '#7ee0ac': { wash: '--green-vivid', ink: '--green-soft-ink', line: '--green-vivid' },
  '#67ba85': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#5ac187': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#9ed3ab': { wash: '--green-bright', ink: '--green-soft-ink', line: '--green-bright' },
  '#a3d8b5': { wash: '--green-bright', ink: '--green-soft-ink', line: '--green-bright' },
  '#604e42': { wash: '--brown', ink: '--brown', line: '--brown' },
  '#ab8e7c': { wash: '--brown-bright', ink: '--copper-ink', line: '--brown-bright' },
  '#b99a86': { wash: '--copper', ink: '--copper-ink', line: '--copper' },
  '#574c80': { wash: '--purple', ink: '--purple', line: '--purple' },
  '#937fcd': { wash: '--purple-bright', ink: '--purple-ink', line: '--purple-bright' },
  '#c9bdf0': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#e0b45c': { wash: '--gold', ink: '--gold-ink', line: '--gold' },
  '#ff9717': { wash: '--orange', ink: '--orange-ink', line: '--orange' },
  '#e26d6d': { wash: '--red', ink: '--red-ink', line: '--red' },
  '#ef9196': { wash: '--rose', ink: '--red-ink', line: '--rose' },
  '#d05f5f': { wash: '--red', ink: '--red-ink', line: '--red' },
  '#ff6969': { wash: '--form-error', ink: '--red-ink', line: '--form-error' },
  /* کارت‌های رنگی صفحهٔ اصلی و پنل‌های عمیق */
  '#302942': { wash: '--card-lavender', ink: '--purple-ink', line: '--purple' },
  '#342b27': { wash: '--card-copper', ink: '--copper-ink', line: '--brown-bright' },
  '#25312b': { wash: '--card-sage', ink: '--green-ink', line: '--green-bright' },
  '#1f2c3d': { wash: '--card-sky', ink: '--blue-ink', line: '--blue-bright' },
  '#302925': { wash: '--card-warm', ink: '--copper-ink', line: '--brown-bright' },
  '#132943': { wash: '--blue-deep', ink: '--blue-ink', line: '--blue' },
  '#285584': { wash: '--blue', ink: '--blue-ink', line: '--blue' },
  /* تیره‌ای که در بافت متن «مرکب عمدی» است نه سطح */
  '#181818': { wash: '--background', ink: '--ink-deep', line: '--border-solid' },
  /* آبی‌های میانی که پرکنندهٔ دکمه/چیپ‌اند: در تم روشن باید روشن بمانند */
  '#396092': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#3c6ea5': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#4d84c4': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#3576b4': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#4f83bd': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#4b79af': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#416f9f': { wash: '--blue-bright', ink: '--blue-ink', line: '--blue-bright' },
  '#7fb2e0': { wash: '--blue-bright', ink: '--blue-soft-ink', line: '--blue-bright' },
  '#7fb4e3': { wash: '--blue-bright', ink: '--blue-soft-ink', line: '--blue-bright' },
  '#80afe2': { wash: '--blue-bright', ink: '--blue-soft-ink', line: '--blue-bright' },
  '#a8caec': { wash: '--blue-bright', ink: '--blue-soft-ink', line: '--blue-bright' },
  /* بنفش‌های میانی */
  '#6c5bb0': { wash: '--purple-bright', ink: '--purple-ink', line: '--purple-bright' },
  '#8a76c8': { wash: '--purple-bright', ink: '--purple-ink', line: '--purple-bright' },
  '#6f5fae': { wash: '--purple-bright', ink: '--purple-ink', line: '--purple-bright' },
  '#7f6dbd': { wash: '--purple-bright', ink: '--purple-ink', line: '--purple-bright' },
  '#8d7fbc': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#b3a3e0': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#b6a6e6': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#a5a0d6': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#908bc6': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#a08fd8': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#a390da': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  '#a390dd': { wash: '--purple-bright', ink: '--purple-soft-ink', line: '--purple-bright' },
  /* سبزهای میانی */
  '#5fae7c': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#46945f': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#6cc08c': { wash: '--green-bright', ink: '--green-ink', line: '--green-bright' },
  '#7ee0a9': { wash: '--green-vivid', ink: '--green-soft-ink', line: '--green-vivid' },
  '#a9d6b6': { wash: '--green-bright', ink: '--green-soft-ink', line: '--green-bright' },
  '#a7cbb0': { wash: '--green-bright', ink: '--green-soft-ink', line: '--green-bright' },
  /* سبز/آبی/بنفش عمیق: در تم روشن باید روشن شوند */
  '#2b3d31': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#3d5244': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#294331': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#477253': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#2b6644': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#172d20': { wash: '--green-deep', ink: '--ink-deep', line: '--green-deep' },
  '#3a5c8c': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#2f5c8f': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#2a6396': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#23405f': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#285782': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#16375a': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#1d4470': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#183158': { wash: '--blue-deep', ink: '--ink-deep', line: '--blue-deep' },
  '#2e2a3a': { wash: '--purple-deep', ink: '--ink-deep', line: '--purple-deep' },
  '#3a2628': { wash: '--red-deep', ink: '--ink-deep', line: '--red-deep' },
  '#654f40': { wash: '--copper-deep', ink: '--ink-deep', line: '--copper-deep' },
  '#a3826e': { wash: '--copper', ink: '--copper-ink', line: '--copper' },
  '#d8b06a': { wash: '--gold', ink: '--gold-ink', line: '--gold' },
  '#ffab3e': { wash: '--orange', ink: '--orange-ink', line: '--orange' },
  '#ea7f7f': { wash: '--red', ink: '--red-ink', line: '--red' },
  '#657487': { wash: '--surface-strong', ink: '--faint', line: '--border-solid' },
};

/* خانوادهٔ اکسنت از روی فام رنگ */
function familyOf(hue) {
  if (hue < 20 || hue >= 345) return 'red';
  if (hue < 100) return 'gold';
  if (hue < 200) return 'green';
  if (hue < 246) return 'blue';
  if (hue < 278) return 'purple';
  return 'red';
}

/* نوارهای خنثی — تنها جایی که تصمیم «چند تیره» گرفته می‌شود */
function inkToken(L) {
  if (L <= 30) return '--ink-deep';
  if (L <= 110) return '--ghost';
  if (L <= 160) return '--faint';
  if (L <= 227) return '--muted';
  return '--white';
}

function washToken(L) {
  if (L <= 14) return '--deep';
  if (L <= 30) return '--background';
  if (L <= 39) return '--surface';
  if (L <= 49) return '--surface-soft';
  if (L <= 78) return '--surface-strong';
  if (L <= 170) return '--light-fill';
  if (L <= 250) return '--light-fill-soft';
  return '--pure';
}

const NEUTRAL_MAX_SAT = 12;

/* هستهٔ تصمیم: یک رنگ + بافت → نام توکن (یا null یعنی دست‌نزن) */
function tokenFor(hex, context) {
  const key = hex.toLowerCase();
  const explicit = EXPLICIT[key];
  if (explicit) return context in explicit ? explicit[context] : explicit.wash;

  const rgb = parseHex(key);
  const sat = saturation(rgb);
  const L = lightness(rgb);

  if (sat <= NEUTRAL_MAX_SAT) {
    if (context === 'line') return '--border-solid';
    if (context === 'ink') return inkToken(L);
    return washToken(L);
  }

  /* رنگی است */
  const family = familyOf(hueOf(rgb));

  if (context === 'ink') {
    /* تیره‌های رنگی «مرکب روی اکسنت»اند و در هر دو تم باید تیره بمانند */
    if (L <= 60) return null;
    return L <= 195 ? `--${family}-ink` : `--${family}-soft-ink`;
  }

  /* خط: فقط تیره‌های رنگی روشن می‌شوند، اکسنت‌های روشن در هر دو تم ثابت‌اند */
  if (context === 'line') return L <= 60 ? `--${family}-deep` : null;

  /* پرکننده: تیره و میانی به توکن اکسنت می‌رود تا در تم روشن با متن تیره بخواند */
  if (L <= 60) return `--${family}-deep`;
  if (L <= 145) return `--${family}`;
  return null;
}

/* ───────────────────────────── گزارش ───────────────────────────── */

const report = { mapped: new Map(), kept: new Map(), files: [] };
const note = (map, key) => map.set(key, (map.get(key) || 0) + 1);

/* ───────────────────────────── JSX ───────────────────────────── */

const UTIL_CTX = {
  bg: 'wash',
  from: 'wash',
  to: 'wash',
  via: 'wash',
  shadow: 'wash',
  text: 'ink',
  fill: 'ink',
  stroke: 'ink',
  placeholder: 'ink',
  decoration: 'ink',
  accent: 'ink',
  caret: 'ink',
  border: 'line',
  ring: 'line',
  outline: 'line',
  divide: 'line',
};

const HEX_IN_BRACKETS =
  /(?<![\w-])(bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|decoration|divide|placeholder|accent|caret)-\[(#[0-9a-fA-F]{3,8})\](?!\/)/g;

const COLOR_PROPS =
  /\b(background|backgroundColor|backgroundImage|color|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|fill|stroke|outlineColor|caretColor|boxShadow|textShadow)\s*:\s*(['"])([^'"\n]*)\2/g;

const SVG_COLOR_ATTR = /\b(fill|stroke|color)="(#[0-9a-fA-F]{3,8})"/g;

function contextForProp(prop) {
  const p = prop.toLowerCase();
  if (p === 'fill' || p === 'stroke' || p === 'color' || p === 'caretcolor' || p === 'outlinecolor') return 'ink';
  if (p.startsWith('border')) return 'line';
  return 'wash';
}

function replaceHexes(value, context) {
  return value.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
    const token = tokenFor(hex, context);
    if (!token) {
      note(report.kept, `${context}:${hex.toLowerCase()}`);
      return hex;
    }
    note(report.mapped, `${context}:${hex.toLowerCase()} → ${token}`);
    return `var(${token})`;
  });
}

function replaceAlphas(value, context) {
  return value
    .replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, (whole, a) => {
      const base = context === 'ink' ? '--ink-rgb' : context === 'line' ? '--line-rgb' : '--wash-rgb';
      note(report.mapped, `${context}:rgba(255,255,255,${a}) → rgb(var(${base}) / ${a})`);
      return `rgb(var(${base}) / ${a})`;
    })
    .replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/g, (whole, a) => {
      if (context === 'line') {
        note(report.mapped, `line:rgba(0,0,0,${a}) → rgb(var(--line-rgb) / ${a})`);
        return `rgb(var(--line-rgb) / ${a})`;
      }
      note(report.kept, `${context}:rgba(0,0,0,${a})`);
      return whole;
    });
}

/* سایه: مشکی نیمه‌شفاف با مقیاس تم، تا در حالت روشن سنگین نماند */
function replaceShadowAlphas(value) {
  return value
    .replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/g, (whole, a) => {
      note(report.mapped, `shadow:rgba(0,0,0,${a}) → calc-scale`);
      return `rgb(var(--shadow-rgb) / calc(${a} * var(--shadow-scale)))`;
    })
    .replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, (whole, a) => {
      note(report.mapped, `shadow:rgba(255,255,255,${a}) → calc-scale`);
      return `rgb(var(--shadow-rgb) / calc(${a} * var(--shadow-scale)))`;
    });
}

function migrateJsx(source) {
  let out = source.replace(HEX_IN_BRACKETS, (whole, util, hex) => {
    const context = UTIL_CTX[util] ?? 'wash';
    const token = tokenFor(hex, context);
    if (!token) {
      note(report.kept, `${context}:${hex.toLowerCase()}`);
      return whole;
    }
    note(report.mapped, `${context}:${hex.toLowerCase()} → ${token}`);
    return `${util}-[var(${token})]`;
  });

  out = out.replace(COLOR_PROPS, (whole, prop, quote, value) => {
    if (!/#[0-9a-fA-F]{3,8}\b|rgba\(/.test(value)) return whole;
    const context = contextForProp(prop);
    const isShadow = /shadow/i.test(prop);
    let next = replaceHexes(value, context);
    next = isShadow ? replaceShadowAlphas(next) : replaceAlphas(next, context);
    return `${prop}: ${quote}${next}${quote}`;
  });

  out = out.replace(SVG_COLOR_ATTR, (whole, attr, hex) => {
    const token = tokenFor(hex, 'ink');
    if (!token) {
      note(report.kept, `ink:${hex.toLowerCase()}`);
      return whole;
    }
    note(report.mapped, `ink:${hex.toLowerCase()} → ${token}`);
    return `${attr}="var(${token})"`;
  });

  return out;
}

/* ───────────────────────────── CSS ───────────────────────────── */

const INK_PROPS = /^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color|stop-color|flood-color|accent-color)$/;
const LINE_PROPS = /^(border|border-[a-z-]+|outline|outline-[a-z-]+|column-rule|column-rule-color)$/;
const SHADOW_PROPS = /^(box-shadow|text-shadow|-webkit-box-shadow)$/;
const WASH_PROPS = /^(background|background-color|background-image)$/;

function contextOf(prop) {
  const p = prop.trim().toLowerCase();
  if (p.startsWith('--')) {
    /* تعریف خودِ توکن‌های تم دست‌نخورده می‌ماند */
    if (CANONICAL.has(p.slice(2))) return null;
    if (/text|ink|fg|muted|foreground/.test(p)) return 'ink';
    if (/border|line|divider/.test(p)) return 'line';
    return 'wash';
  }
  if (INK_PROPS.test(p)) return 'ink';
  if (SHADOW_PROPS.test(p)) return 'wash';
  if (LINE_PROPS.test(p)) return 'line';
  if (WASH_PROPS.test(p)) return 'wash';
  return null;
}

function migrateCss(source) {
  let out = source.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectors, body) => {
    const migrated = body
      .split(';')
      .map((decl) => {
        const idx = decl.indexOf(':');
        if (idx < 0) return decl;
        const prop = decl.slice(0, idx);
        const value = decl.slice(idx + 1);
        const context = contextOf(prop);
        if (!context) return decl;
        if (!/#[0-9a-fA-F]{3,8}\b|rgba\(/.test(value)) return decl;

        let next = replaceHexes(value, context);
        next = SHADOW_PROPS.test(prop.trim().toLowerCase())
          ? replaceShadowAlphas(next)
          : replaceAlphas(next, context);
        return `${prop}:${next}`;
      })
      .join(';');
    return `${selectors}{${migrated}}`;
  });

  /* آیکون‌های تک‌فام: در تم روشن باید تیره شوند نه سفید */
  out = out.replace(/filter:\s*brightness\(0\)\s+invert\(1\)/g, () => {
    note(report.mapped, 'filter:brightness(0) invert(1) → var(--icon-filter)');
    return 'filter: var(--icon-filter)';
  });

  return out;
}

/* ───────────────────────────── اجرا ───────────────────────────── */

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (/\.(jsx?|css)$/.test(entry.name)) list.push(full);
  }
  return list;
}

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (SKIP_FILES.has(rel)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const next = file.endsWith('.css') ? migrateCss(source) : migrateJsx(source);
  if (next !== source) {
    report.files.push(rel);
    if (!DRY) fs.writeFileSync(file, next);
  }
}

const lines = [];
lines.push(`files touched: ${report.files.length}${DRY ? ' (dry run)' : ''}`);
lines.push('');
lines.push(`── mapped (${report.mapped.size} distinct) ──`);
for (const [k, v] of [...report.mapped.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`${String(v).padStart(6)}  ${k}`);
}
lines.push('');
lines.push(`── left untouched (${report.kept.size} distinct) ──`);
for (const [k, v] of [...report.kept.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`${String(v).padStart(6)}  ${k}`);
}
const text = lines.join('\n');
fs.writeFileSync(path.join(ROOT, 'scripts/theme-report.txt'), text);
console.log(text.split('\n').slice(0, 30).join('\n'));
console.log('  ...');
console.log(`report: scripts/theme-report.txt  (${report.mapped.size} mapped / ${report.kept.size} kept / ${report.files.length} files)`);
