#!/usr/bin/env node
/*
 * موجودی و انطباق قرارداد API — فاز ۷، بخش‌های ۱۴ و ۲۲.
 *
 * چه می‌کند:
 *   ۱) مسیرهای واقعی هر چهار لایهٔ API را از **سورس** استخراج می‌کند.
 *   ۲) به هر مسیر فراداده می‌چسباند: احراز هویت، CSRF، مجوز، سقف بدنه،
 *      پوشش DTO و پوشش خطا.
 *   ۳) انطباق را می‌سنجد (کد خطای ناشناخته، مسیر عمومی بدون DTO،
 *      مسیر ادمین بدون مجوز و بدون ثبت در `AUTHENTICATED_ONLY_PATHS`).
 *   ۴) خروجی ماشین‌خوان می‌نویسد: `docs/api/api-contract.json`.
 *
 * ⚠️ ایستا است: سورس را می‌خواند، اجرا نمی‌کند. پس «استخراج شد» یعنی
 * «در متن دیده شد»، نه «در اجرا اثبات شد». اثبات اجرایی کار تست‌ها است.
 *
 * استفاده:
 *   node scripts/api-contract.mjs            # گزارش + نوشتن JSON
 *   node scripts/api-contract.mjs --json     # فقط JSON روی stdout
 *   node scripts/api-contract.mjs --selftest # خودآزمون پارسر
 *   node scripts/api-contract.mjs --check    # فقط انطباق؛ exit≠0 در نقض
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractRouteTable, extractPatternList, extractComparedPaths, matchBracket } from './lib/js-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

const adminSrc = read('database/adminApi.js');
const examSrc = read('database/examApi.js');
const usersSrc = read('database/usersApi.js');
const googleSrc = read('database/googleAuth.js');
const errorSrc = read('database/apiContract/errorModel.js');
const dtoSrc = read('database/apiContract/dtos.js');

/* ─────────────────── سقف بدنه — از سورس ─────────────────── */

function numericConst(source, name) {
  const hit = new RegExp(`const ${name}\\s*=\\s*([0-9_]+)\\s*\\*\\s*1024\\s*\\*\\s*1024`).exec(source);
  if (hit) return Number(hit[1].replace(/_/g, '')) * 1024 * 1024;
  const plain = new RegExp(`const ${name}\\s*=\\s*([0-9_]+)`).exec(source);
  return plain ? Number(plain[1].replace(/_/g, '')) : null;
}

const BODY_LIMITS = {
  admin: { default: numericConst(adminSrc, 'MAX_BODY_BYTES'), unit: 'bytes' },
  exam: { default: numericConst(examSrc, 'MAX_BODY_BYTES'), unit: 'bytes' },
  users: { default: 1e6, unit: 'bytes', evidence: 'usersApi.js:88 — `size > 1e6`' },
  google: { default: null, unit: 'bytes', evidence: 'فقط GET/HEAD — بدنه‌ای خوانده نمی‌شود' },
};

/* سقف‌های نقطه‌ای که در بدنهٔ `handleApi` صریح‌اند */
const INLINE_LIMITS = [
  ['/api/public/analytics/collect', 64 * 1024],
  ['/api/public/feedback', 64 * 1024],
  ['/api/public/feedback/replies/read', 8 * 1024],
];

/* ─────────────────── مجوزهای فقط-ورود و فهرست‌های سرور ─────────────────── */

function extractSetLiteral(source, name) {
  const index = source.indexOf(`const ${name} = new Set([`);
  if (index === -1) return [];
  const start = source.indexOf('[', index);
  const end = matchBracket(source, start);
  if (end === -1) return [];
  return [...source.slice(start + 1, end).matchAll(/'([^']+)'/g)].map((hit) => hit[1]);
}

const AUTHENTICATED_ONLY_PATHS = extractSetLiteral(adminSrc, 'AUTHENTICATED_ONLY_PATHS');
const PUBLIC_ADMIN_PATHS = extractSetLiteral(adminSrc, 'PUBLIC_ADMIN_PATHS');

/* ─────────────────── کدهای خطای واقعی در سورس ─────────────────── */

/*
 * اسکن **کل** `database/` و `scripts/` — نه فقط چهار فایل مرز API.
 * چرا: بخشی از کدهای خطا در فروشگاه‌ها ساخته می‌شوند (`authError('…')`،
 * `code: 'NOT_FOUND'`) و اگر فقط مرز API اسکن شود، شکاف مدل دیده نمی‌شود.
 * ⚠️ محدودیت: هر کد خطایی که به‌صورت رشتهٔ پویا ساخته شود دیده نمی‌شود.
 */
function collectSourceFiles(directory, extensions = ['.js', '.mjs']) {
  const out = [];
  for (const entry of readdirSync(resolve(ROOT, directory), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.workbuddy-ai'].includes(entry.name)) continue;
      out.push(...collectSourceFiles(`${directory}/${entry.name}`, extensions));
      continue;
    }
    if (extensions.some((extension) => entry.name.endsWith(extension))) out.push(`${directory}/${entry.name}`);
  }
  return out;
}

function errorCodesIn(source) {
  const codes = new Set();
  for (const hit of source.matchAll(/\b(?:fail|httpError|authError|reject|invalid)\(\s*'([A-Z][A-Z0-9_]{2,})'/g)) codes.add(hit[1]);
  for (const hit of source.matchAll(/(?:code|errorCode)\s*:\s*'([A-Z][A-Z0-9_]{2,})'/g)) codes.add(hit[1]);
  return [...codes];
}

const SOURCE_FILES = [...collectSourceFiles('database'), ...collectSourceFiles('scripts')];
const usedCodes = new Set();
for (const file of SOURCE_FILES) {
  for (const code of errorCodesIn(read(file))) usedCodes.add(code);
}

const KNOWN_ERROR_CODES = [...errorSrc.matchAll(/^\s{2}([A-Z_]+):\s*SPEC\(/gm)].map((hit) => hit[1]);

/* ─────────────────── موجودی مسیرها ─────────────────── */

const routes = [];

/* ۱) مسیرهای ادمین — جدول ROUTES (deny-by-default) */
for (const route of extractRouteTable(adminSrc, 'ROUTES')) {
  routes.push({
    api: 'admin',
    method: route.method,
    path: route.pattern,
    auth: PUBLIC_ADMIN_PATHS.includes(route.pattern) ? 'public' : 'session',
    csrf: route.method === 'GET' ? 'no' : 'yes',
    permission: route.permission ?? null,
    permissionMode: route.permission
      ? 'permission'
      : (AUTHENTICATED_ONLY_PATHS.includes(route.pattern) ? 'authenticated-only' : 'deny-by-default'),
    bodyLimit: route.method === 'GET' ? null : BODY_LIMITS.admin.default,
    dto: null,
  });
}

/* ۲) مسیرهای عمومی سایت — PUBLIC_ROUTES (GET فقط، آرایهٔ دوتایی) */
for (const pattern of extractPatternList(adminSrc, 'PUBLIC_ROUTES')) {
  routes.push({
    api: 'public',
    method: 'GET',
    path: pattern,
    auth: 'none',
    csrf: 'no',
    permission: null,
    permissionMode: 'public',
    bodyLimit: null,
    dto: `GET ${pattern}`,
  });
}

/* ۳) مسیرهای عمومی ویژه — بیرون از جدول PUBLIC_ROUTES */
routes.push({
  api: 'public', method: 'POST', path: '/api/public/analytics/collect', auth: 'none', csrf: 'no',
  permission: null, permissionMode: 'public', bodyLimit: 64 * 1024, dto: null,
});
routes.push({
  api: 'public', method: 'POST', path: '/api/public/feedback', auth: 'optional-session', csrf: 'no',
  permission: null, permissionMode: 'public', bodyLimit: 64 * 1024, dto: null,
});
for (const path of ['/api/public/feedback/replies', '/api/public/feedback/replies/read']) {
  routes.push({
    api: 'public', method: path.endsWith('/read') ? 'POST' : 'GET', path, auth: 'session-or-client-id',
    csrf: 'no', permission: null, permissionMode: 'public',
    bodyLimit: path.endsWith('/read') ? 8 * 1024 : null, dto: null,
  });
}

/* ۴) آپلود دودویی بین‌الملل — بیرون از ROUTES، با همان سه لایهٔ امنیتی */
routes.push({
  api: 'admin', method: 'POST', path: '/api/admin/intl-courses/upload', auth: 'session', csrf: 'yes',
  permission: 'intl.upload', permissionMode: 'permission',
  bodyLimit: 'settings.media.maxVideoUploadMb', dto: null,
});

/* ۵) API آزمون‌های هماهنگ */
for (const route of extractRouteTable(examSrc, 'ROUTES')) {
  routes.push({
    api: 'exam',
    method: route.method,
    path: route.pattern,
    auth: route.permission === true ? 'session' : route.permission === 'anon-ok' ? 'anonymous-ok' : 'optional',
    csrf: route.method === 'GET' ? 'no' : 'yes (x-tapesh-exam)',
    permission: null,
    permissionMode: route.permission === true ? 'session' : 'public',
    bodyLimit: route.method === 'GET' ? null : BODY_LIMITS.exam.default,
    dto: null,
  });
}

/* ۶) API کاربران سایت */
for (const hit of usersSrc.matchAll(/method === '([A-Z]+)'\s*&&\s*path === '([^']+)'/g)) {
  const [, method, path] = hit;
  routes.push({
    api: 'users',
    method,
    path: `/api/users${path}`,
    auth: path === '/register' || path === '/login' ? 'none' : 'session-or-guest',
    csrf: method === 'GET' ? 'no' : 'same-origin',
    permission: null,
    permissionMode: 'public',
    bodyLimit: method === 'GET' ? null : BODY_LIMITS.users.default,
    dto: null,
  });
}

/* ۷) جریان گوگل */
for (const hit of googleSrc.matchAll(/action === '([^']+)'/g)) {
  routes.push({
    api: 'google', method: 'GET', path: `/api/auth/google${hit[1]}`, auth: 'none', csrf: 'no',
    permission: null, permissionMode: 'public', bodyLimit: null, dto: null,
  });
}

/* ─────────────────── انطباق ─────────────────── */

const violations = [];

/* الف) کد خطای مصرف‌شده که در مدل مرکزی نیست */
const unknownCodes = [...usedCodes].filter((code) => !KNOWN_ERROR_CODES.includes(code));

/* ب) مسیر عمومی که DTO ثبت‌شده ندارد */
const DTO_KEYS = [...dtoSrc.matchAll(/^\s{2}'([^']+)':\s*\{/gm)].map((hit) => hit[1]);
const publicWithoutDto = routes
  .filter((route) => route.api === 'public' && route.dto && !DTO_KEYS.includes(route.dto))
  .map((route) => route.path);

/* ج) مسیر ادمین با `null` که نه در `AUTHENTICATED_ONLY_PATHS` است و نه در جدول ROUTES مجوز دارد */
const adminDenyByDefault = routes
  .filter((route) => route.api === 'admin' && route.permissionMode === 'deny-by-default')
  .map((route) => route.path);

/* د) سقف بدنهٔ ناهمگون */
const bodyLimitValues = new Set(
  routes.map((route) => route.bodyLimit).filter((value) => typeof value === 'number'),
);

if (unknownCodes.length) violations.push(`کد خطای خارج از مدل مرکزی: ${unknownCodes.join(', ')}`);
if (publicWithoutDto.length) violations.push(`مسیر عمومی بدون DTO: ${publicWithoutDto.join(', ')}`);
if (adminDenyByDefault.length) violations.push(`مسیر ادمین با مجوز null و خارج از فهرست فقط-ورود: ${adminDenyByDefault.join(', ')}`);

/*
 * ه) مسیر نوشتن بدون قرارداد ورودی — فاز ۴ (fail-closed).
 *
 * چرا اینجا و نه در تست: تست فقط وقتی اجرا می‌شود که کسی اجرا کند. این دروازه
 * در CI سوار است، پس مسیر نوشتن تازه **نمی‌تواند** بدون قرارداد وارد main شود.
 * رجیستری از `database/apiContract/routeContracts.js` می‌آید که خودش با
 * `scripts/generate-route-contracts.mjs` از همین جدول ساخته می‌شود.
 */
const { ROUTE_CONTRACTS, CONTRACT_SUMMARY } = await import('../database/apiContract/routeContracts.js');

const writeRoutes = routes.filter((route) => route.method !== 'GET' && route.method !== 'HEAD');
const writeRoutesWithoutInputContract = writeRoutes
  .filter((route) => !Object.hasOwn(ROUTE_CONTRACTS, `${route.method} ${route.path}`))
  .map((route) => `${route.method} ${route.path}`);

if (writeRoutesWithoutInputContract.length) {
  violations.push(`مسیر نوشتن بدون قرارداد ورودی: ${writeRoutesWithoutInputContract.join(', ')}`);
}

/* ─────────────────── خودآزمون پارسر ─────────────────── */

function selfTest() {
  const failures = [];
  const probe = "const ROUTES = [\n  ['GET', '/api/x/:id', null, async () => 1],\n  ['POST', '/api/y', 'perm.a', async () => 2],\n];\n";
  const parsed = extractRouteTable(probe, 'ROUTES');
  if (parsed.length !== 2) failures.push('extractRouteTable تعداد روت را غلط شمرد');
  if (parsed[0]?.permission !== null) failures.push('extractRouteTable مجوز null را غلط خواند');
  if (parsed[1]?.permission !== 'perm.a') failures.push('extractRouteTable مجوز رشته‌ای را غلط خواند');
  if (extractComparedPaths("if (method === 'GET' && path === '/me') {}", ['path'])[0] !== '/me') {
    failures.push('extractComparedPaths مسیر مقایسه‌ای را نیافت');
  }
  const twoTuple = "const PUBLIC_ROUTES = [\n  ['/api/public/a', async () => 1],\n  ['/api/public/b/:s', async () => fail('NOT_FOUND', 'پیدا نشد')],\n];\n";
  const patterns = extractPatternList(twoTuple, 'PUBLIC_ROUTES');
  if (patterns.length !== 2 || patterns[0] !== '/api/public/a' || patterns[1] !== '/api/public/b/:s') {
    failures.push('extractPatternList آرایهٔ دوتایی را غلط خواند');
  }
  if (numericConst('const MAX_BODY_BYTES = 12 * 1024 * 1024;', 'MAX_BODY_BYTES') !== 12582912) {
    failures.push('numericConst سقف بدنه را غلط خواند');
  }
  return failures;
}

const selfTestFailures = selfTest();
if (process.argv.includes('--selftest')) {
  if (selfTestFailures.length) {
    for (const line of selfTestFailures) console.log(`  ✗ ${line}`);
    process.exit(1);
  }
  console.log('  ✓ خودآزمون پارسر قرارداد API سبز');
  process.exit(0);
}

/* ─────────────────── خروجی ─────────────────── */

const report = {
  generatedAt: new Date().toISOString(),
  phase: '07',
  counts: {
    total: routes.length,
    byApi: routes.reduce((accumulator, route) => {
      accumulator[route.api] = (accumulator[route.api] ?? 0) + 1;
      return accumulator;
    }, {}),
    writes: routes.filter((route) => route.method !== 'GET').length,
    errorCodesInModel: KNOWN_ERROR_CODES.length,
    errorCodesUsed: usedCodes.size,
    publicDtos: DTO_KEYS.length,
  },
  bodyLimits: BODY_LIMITS,
  inlineLimits: INLINE_LIMITS,
  bodyLimitValues: [...bodyLimitValues],
  unknownErrorCodes: unknownCodes,
  publicRoutesWithoutDto: publicWithoutDto,
  writeRoutesWithoutInputContract,
  inputContracts: CONTRACT_SUMMARY,
  adminDenyByDefault,
  violations,
  routes,
};

if (process.argv.includes('--json')) {
  /* نوشتن همگام روی fd ۱ — همان درسِ باگِ بریدگی ۶۴KB در pipe. */
  writeFileSync(1, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(violations.length ? 1 : 0);
}

if (process.argv.includes('--check')) {
  if (violations.length) {
    for (const line of violations) console.error(`  ✗ ${line}`);
    process.exit(1);
  }
  console.log(
    `  ✓ انطباق قرارداد API سبز — ${routes.length} مسیر، ${KNOWN_ERROR_CODES.length} کد خطا، ${DTO_KEYS.length} DTO`,
  );
  console.log(
    `    قرارداد ورودی: ${CONTRACT_SUMMARY.total} مسیر نوشتن (entity ${CONTRACT_SUMMARY.entity} · object ${CONTRACT_SUMMARY.object} · none ${CONTRACT_SUMMARY.none}) · بدون قرارداد ${writeRoutesWithoutInputContract.length}`,
  );
  process.exit(0);
}

const pad = (value, width) => {
  const text = String(value ?? '—');
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
};

console.log('');
console.log('── موجودی قرارداد API (فاز ۷) ──');
console.log(`  مسیر کل                : ${routes.length}`);
for (const [api, count] of Object.entries(report.counts.byApi)) console.log(`    ${pad(api, 8)} : ${count}`);
console.log(`  مسیر نوشتن              : ${report.counts.writes}`);
console.log(`  کد خطا در مدل / مصرف‌شده : ${KNOWN_ERROR_CODES.length} / ${usedCodes.size}`);
console.log(`  DTO عمومی               : ${DTO_KEYS.length}`);
console.log(`  سقف بدنه (بایت)         : ${[...bodyLimitValues].sort((a, b) => a - b).join(' · ')}`);
console.log('');
console.log(`  ${pad('API', 8)}${pad('متد', 7)}${pad('مسیر', 46)}${pad('auth', 20)}${pad('مجوز', 22)}سقف`);
console.log(`  ${'─'.repeat(112)}`);
for (const route of routes) {
  console.log(`  ${pad(route.api, 8)}${pad(route.method, 7)}${pad(route.path, 46)}${pad(route.auth, 20)}${pad(route.permission ?? route.permissionMode, 22)}${route.bodyLimit ?? '—'}`);
}

if (violations.length) {
  console.log('');
  console.log('── نقض انطباق ──');
  for (const line of violations) console.log(`  ✗ ${line}`);
}

mkdirSync(resolve(ROOT, 'docs/api'), { recursive: true });
const out = resolve(ROOT, 'docs/api/api-contract.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('');
console.log('  JSON: docs/api/api-contract.json');
console.log(`  وضعیت انطباق: ${violations.length ? `✗ ${violations.length} نقض` : '✓ سبز'}`);
console.log('');
/* بدون `process.exit` — تا خروجی بزرگ روی pipe بریده نشود (درسِ باگِ ۶۴KB). */
process.exitCode = violations.length ? 1 : 0;
