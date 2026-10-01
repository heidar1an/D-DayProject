/*
 * تولید رجیستری قرارداد ورودی مسیرهای نوشتن — فاز ۴.
 *
 * چرا تولید و نه دست‌نویس: قرارداد باید **هم‌گام با سورس** بماند. اگر کسی مسیری
 * اضافه کند و رجیستری را دستی به‌روز نکند، دو منبع حقیقت پیدا می‌شود. این ابزار
 * جدول مسیرها را از همان `scripts/api-contract.mjs --json` می‌خواند که دروازهٔ
 * CI هم از آن استفاده می‌کند — پس یک منبع، دو مصرف.
 *
 * اجرا:  node scripts/generate-route-contracts.mjs
 *        node scripts/generate-route-contracts.mjs --check   # فقط می‌سنجد که کهنه نیست
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'database/apiContract/routeContracts.js');
const checkOnly = process.argv.includes('--check');

const result = spawnSync(process.execPath, ['scripts/api-contract.mjs', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error('✗ خروجی JSON قرارداد API خوانده نشد:', error.message);
  process.exit(2);
}

/* همان نگاشت دامنه‌ای که `apiContract/input.js` دارد — یک منبع. */
const { ENTITY_BY_ROUTE_DOMAIN } = await import('../database/apiContract/input.js');

/** استخراج دامنه از مسیر: `/api/admin/articles/:id` ⇒ `articles`. */
function domainOf(path) {
  const segments = String(path).split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const rest = segments.slice(apiIndex + 2); /* بعد از api/<لایه> */
  return rest[0] ?? '';
}

/** مسیرهای نوشتن که عمداً بدنهٔ JSON ندارند (آپلود جریانی، تأیید بدون بدنه). */
const NON_JSON_BODY = new Set([
  'POST /api/admin/media/upload',
  'POST /api/admin/intl/upload',
  'POST /api/admin/media/notifications/refresh',
  'POST /api/admin/media/notifications/read-all',
  'POST /api/admin/media/demo/clear',
  'POST /api/admin/media/demo/seed',
]);

/*
 * مسیرهایی که «شکل بدنهٔ سیم» با «شکل رکورد مدل» یکی است و اعتبارسنجی کامل
 * entity روی آن‌ها بی‌خطر است.
 *
 * ⚠️ چرا فقط این‌ها (یافتهٔ واقعی این فاز، با شاهد اجرایی): نگاشت سادهٔ
 * «دامنه → Entity» **غلط** است. مثال مستند: `POST /api/admin/articles` با
 * `{title, category, status:'published', contentHtml}` پاسخ ۴۰۰ می‌دهد با
 * `publishedAt: missing_published_at` — چون قاعدهٔ بین‌فیلدیِ Schema برای رکورد
 * منتشرشده، `publishedAt` می‌خواهد ولی **هندلر خودش آن را می‌سازد**. یعنی
 * قرارداد سیم (API) و قرارداد انبار (مدل) یکی نیستند.
 *
 * پس `entity` فقط جایی می‌نشیند که هندلر خودش هم `assertInputValid('<entity>')`
 * را صدا می‌زند — یعنی دو طرف قرارداد را یکی می‌داند. بقیه `object` می‌گیرند و
 * این بدهی در گزارش فاز صریح ثبت شده است (نه پنهان).
 */
const ENTITY_WIRE_VERIFIED = Object.freeze({
  notes: 'note',
});

function contractFor(route) {
  const key = `${route.method} ${route.path}`;
  const domain = domainOf(route.path);
  const entity = ENTITY_WIRE_VERIFIED[domain];

  if (NON_JSON_BODY.has(key)) {
    return { kind: 'none', reason: 'بدنهٔ JSON ندارد (جریان/عملیات بدون payload)' };
  }
  if (entity) {
    /*
     * حالت `update`: فقط فیلدهای **ارسال‌شده** اعتبارسنجی می‌شوند و فیلدهای
     * الزامیِ نیامده رد نمی‌شوند. برای PUT/PATCH/DELETE درست است؛ برای POST هم
     * عمداً همین است تا مسیرهای «ساخت با پیش‌فرض» نشکنند — سخت‌گیری بیشتر یک
     * تصمیم محصولی است، نه چیزی که این فاز یک‌طرفه تحمیل کند.
     */
    return { kind: 'entity', entity, mode: 'update' };
  }
  if (ENTITY_BY_ROUTE_DOMAIN[domain]) {
    return {
      kind: 'object',
      reason: `دامنهٔ «${domain}» Schema دارد ولی بدنهٔ سیم با شکل رکورد مدل یکی نیست؛ قرارداد سیم جدا لازم است`,
    };
  }
  return { kind: 'object', reason: 'دامنهٔ Schema دار ندارد؛ فقط ساختار بدنه سنجیده می‌شود' };
}

const writes = report.routes.filter((route) => route.method !== 'GET' && route.method !== 'HEAD');
const entries = writes
  .map((route) => ({ key: `${route.method} ${route.path}`, api: route.api, ...contractFor(route) }))
  .sort((a, b) => a.key.localeCompare(b.key));

const byKind = entries.reduce((acc, entry) => {
  acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
  return acc;
}, {});

const lines = [];
lines.push('/*');
lines.push(' * رجیستری قرارداد ورودی مسیرهای نوشتن — فاز ۴.');
lines.push(' *');
lines.push(' * ⚠️ این فایل **تولیدشده** است: `node scripts/generate-route-contracts.mjs`.');
lines.push(' * دستی ویرایش نکن؛ با `npm run api:contract:check` کهنه‌بودنش سنجیده می‌شود.');
lines.push(' *');
lines.push(' * نقش آن در دروازه: هر مسیر نوشتن در سورس **باید** اینجا کلید داشته باشد.');
lines.push(' * مسیر نوشتن تازه بدون کلید ⇒ `api:contract:check` قرمز می‌شود. یعنی هیچ');
lines.push(' * endpoint جدیدی نمی‌تواند بدون قرارداد ورودی وارد main شود.');
lines.push(' *');
lines.push(' * انواع قرارداد:');
lines.push(" *   entity — اعتبارسنجی کامل با Schema مدل (`assertInputValid`).");
lines.push(' *   object — فقط «بدنه یک شیء سادهٔ JSON است» (دامنه Schema دار ندارد).');
lines.push(' *   none   — بدنهٔ JSON ندارد (آپلود جریانی / عملیات بدون payload).');
lines.push(' */');
lines.push('');
lines.push('export const ROUTE_CONTRACTS = Object.freeze({');
for (const entry of entries) {
  if (entry.kind === 'entity') lines.push(`  '${entry.key}': { kind: 'entity', entity: '${entry.entity}', mode: '${entry.mode}' },`);
  else if (entry.kind === 'object') lines.push(`  '${entry.key}': { kind: 'object', reason: '${entry.reason}' },`);
  else lines.push(`  '${entry.key}': { kind: 'none', reason: '${entry.reason}' },`);
}
lines.push('});');
lines.push('');
lines.push('/** خلاصه — برای گزارش دروازه و تشخیص «بدهیِ باقی‌مانده». */');
lines.push('export const CONTRACT_SUMMARY = Object.freeze({');
lines.push(`  total: ${entries.length},`);
lines.push(`  entity: ${byKind.entity ?? 0},`);
lines.push(`  object: ${byKind.object ?? 0},`);
lines.push(`  none: ${byKind.none ?? 0},`);
lines.push('});');
lines.push('');

const output = lines.join('\n');

if (checkOnly) {
  const current = (() => {
    try {
      return readFileSync(TARGET, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== output) {
    console.error('✗ رجیستری قرارداد ورودی کهنه است — `node scripts/generate-route-contracts.mjs` را اجرا کن.');
    process.exit(1);
  }
  console.log(`  ✓ رجیستری قرارداد ورودی هم‌گام است — ${entries.length} مسیر نوشتن`);
  process.exit(0);
}

writeFileSync(TARGET, output, 'utf8');
console.log(`✓ رجیستری قرارداد ورودی نوشته شد — ${entries.length} مسیر نوشتن`);
console.log(`  entity: ${byKind.entity ?? 0}   object: ${byKind.object ?? 0}   none: ${byKind.none ?? 0}`);
