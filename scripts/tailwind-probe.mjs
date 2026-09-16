/*
 * tailwind-probe — تأیید اینکه Tailwind v4 واقعاً همان چیزی را می‌سازد که
 * مهاجرت تم فرض کرده. بدون مرورگر و بدون بیلد کامل.
 *
 * اجرا: node scripts/tailwind-probe.mjs
 */
import { compile } from '/Users/heidarian/Documents/my own project/tapeshweb/node_modules/tailwindcss/dist/lib.mjs';

const candidates = [
  /* باید به var() کامپایل شوند تا با تعویض تم عوض شوند */
  'bg-[var(--surface-soft)]',
  'text-[var(--blue-ink)]',
  'border-[var(--line-rgb)]',
  /* باید از --color-white رد شوند (کلید کل تم‌پذیری Tailwind) */
  'text-white',
  'bg-white/5',
  'border-white/8',
  'bg-white',
  'border-white',
  /* مشکی */
  'bg-black',
  'bg-black/25',
  'bg-black/70',
];

const input = '@import "tailwindcss";';

const PROJECT = '/Users/heidarian/Documents/my own project/tapeshweb';

const compiler = await compile(input, {
  base: PROJECT,
  loadStylesheet: async (id) => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const file = path.join(PROJECT, 'node_modules', id, 'index.css');
    return { path: file, base: path.dirname(file), content: readFileSync(file, 'utf8') };
  },
});

const css = compiler.build(candidates);

/* انتخابگرهای واقعیِ تولیدشده را بیرون بکش (Tailwind داخل @layer utilities می‌نویسد) */
const selectors = [...css.matchAll(/^\s*(\.[^\s{]+)\s*\{/gm)].map((m) => m[1]);
console.log('── انتخابگرهای تولیدشده ──');
for (const selector of selectors) console.log('  ' + selector);

/* ── سنجه‌ها ── */
const checks = [];

function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
}

console.log('\n── سنجه‌ها ──');

check(
  'مقدار دلخواه به var() کامپایل می‌شود',
  selectors.includes('.bg-\\[var\\(--surface-soft\\)\\]') &&
    /background-color:\s*var\(--surface-soft\)/.test(css),
  selectors.find((s) => s.includes('surface-soft')) ?? '(پیدا نشد)',
);

check('text-white از --color-white می‌خواند', /color:\s*var\(--color-white\)/.test(css));

check(
  'bg-white/5 با color-mix روی --color-white ساخته می‌شود',
  /color-mix\(in oklab,\s*var\(--color-white\)\s*5%/i.test(css),
);

check(
  'bg-black/25 با color-mix روی --color-black ساخته می‌شود',
  /color-mix\(in oklab,\s*var\(--color-black\)\s*25%/i.test(css),
);

check('bg-white توپُر از var(--color-white) است', /\.bg-white\s*\{\s*background-color:\s*var\(--color-white\)/.test(css));

check('bg-black توپُر از var(--color-black) است', /\.bg-black\s*\{\s*background-color:\s*var\(--color-black\)/.test(css));

/*
 * مهم‌ترین سنجه: انتخابگری که در styles.css نوشته‌ایم باید دقیقاً همان کلاسی
 * باشد که Tailwind تولید می‌کند، وگرنه بازنویسی تم روشن هرگز اعمال نمی‌شود.
 */
const black25 = selectors.find((s) => s.includes('bg-black') && s.includes('25'));
check(
  'نام کلاس تولیدشده با انتخابگر بازنویسی ما یکی است',
  black25 === '.bg-black\\/25',
  `تولیدشده: ${black25}  |  ما: .bg-black\\/25`,
);

const white = selectors.find((s) => s === '.bg-white');
check('نام کلاس bg-white با بازنویسی ما یکی است', white === '.bg-white', String(white));

const borderWhite = selectors.find((s) => s === '.border-white');
check(
  'نام کلاس border-white با بازنویسی ما یکی است',
  borderWhite === '.border-white',
  String(borderWhite),
);

/* ── نتیجه ── */
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length} سنجه — ${checks.length - failed.length} قبول، ${failed.length} رد`);
process.exit(failed.length ? 1 : 0);
