/*
 * پوشش اعتبارسنجی مسیرهای نوشتن — فاز ۸ (Production Readiness).
 *
 * چرا: ممیزی نشان داده بود «contract سیم» و «مدل انبار» دو مفهوم‌اند و باید
 * روشن باشد کدام مسیر نوشتن واقعاً اعتبارسنجی مدل دارد. این ابزار آن تصویر را
 * **ماشین‌خوان** می‌کند تا در CI و گزارش قابل ارجاع باشد.
 *
 * خط لولهٔ درست (که این ابزار ادعای نقضش را نمی‌کند، فقط پوشش را می‌شمارد):
 *   HTTP Input → Input Contract → Normalization → Domain Model → Entity Validation → Persistence
 *
 * اجرا:
 *   node scripts/validation-coverage.mjs
 *   node scripts/validation-coverage.mjs --json
 *   node scripts/validation-coverage.mjs --check   # مسیر نوشتن بدون قرارداد ⇒ exit 1
 *
 * خروجی JSON: `docs/audit/validation-coverage.json`
 *
 * کد خروج: ۰ سبز/گزارش · ۱ مسیر بدون قرارداد (فقط با --check) · ۲ خطای اجرا
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs', 'audit', 'validation-coverage.json');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const CHECK = argv.includes('--check');

const run = spawnSync(process.execPath, ['scripts/api-contract.mjs', '--json'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch (error) {
  console.error('✗ خروجی JSON قرارداد API خوانده نشد:', error.message);
  process.exit(2);
}

const { ROUTE_CONTRACTS } = await import('../database/apiContract/routeContracts.js');

const writeRoutes = report.routes.filter((route) => route.method !== 'GET' && route.method !== 'HEAD');

/*
 * مسیرهایی که عمداً قرارداد «بدون بدنه» دارند: آپلود جریانی یا عملیات
 * بدون payload. «بدون اعتبارسنجی» نیستند — فقط اعتبارسنجی‌شان JSON نیست.
 */
const intentionallyBodyFree = Object.entries(ROUTE_CONTRACTS)
  .filter(([, contract]) => contract.kind === 'none')
  .map(([key]) => key);

const rows = writeRoutes.map((route) => {
  const key = `${route.method} ${route.path}`;
  const contract = ROUTE_CONTRACTS[key];
  return {
    route: key,
    api: route.api,
    auth: route.auth,
    csrf: route.csrf,
    permission: route.permission,
    contract: contract?.kind ?? null,
    entity: contract?.entity ?? null,
    mode: contract?.mode ?? null,
  };
});

const missing = rows.filter((row) => row.contract === null).map((row) => row.route);
const byKind = rows.reduce((acc, row) => {
  const key = row.contract ?? 'missing';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const coverage = {
  generatedAt: new Date().toISOString(),
  phase: '08-validation-coverage',
  totals: {
    writeRoutes: writeRoutes.length,
    entityValidated: byKind.entity ?? 0,
    structuralOnly: byKind.object ?? 0,
    intentionallyBodyFree: byKind.none ?? 0,
    withoutContract: missing.length,
  },
  byKind,
  intentionallyBodyFree,
  missing,
  note: [
    'entity = اعتبارسنجی کامل با Schema مدل دامنه (assertInputValid).',
    'object = فقط «بدنه یک شیء سادهٔ JSON است»؛ شکل دقیق در هندلر سنجیده می‌شود.',
    'none   = بدنهٔ JSON ندارد (آپلود جریانی / عملیات بدون payload).',
    'مسیر خواندن (GET/HEAD) در این شمارش نیست — قرارداد ورودی ندارند.',
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(coverage, null, 2)}\n`, 'utf8');

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(coverage, null, 2)}\n`);
  process.exit(CHECK && missing.length ? 1 : 0);
}

console.log('══ پوشش اعتبارسنجی مسیرهای نوشتن — تپش ══\n');
console.log(`  مسیر نوشتن          : ${coverage.totals.writeRoutes}`);
console.log(`  entity (کامل)       : ${coverage.totals.entityValidated}`);
console.log(`  object (ساختاری)    : ${coverage.totals.structuralOnly}`);
console.log(`  none (بدون بدنه)    : ${coverage.totals.intentionallyBodyFree}`);
console.log(`  بدون قرارداد        : ${coverage.totals.withoutContract}\n`);
if (missing.length) {
  console.log('── مسیرهای بدون قرارداد ──');
  for (const route of missing) console.log(`  ✗ ${route}`);
} else {
  console.log('✓ هیچ مسیر نوشتنی بدون قرارداد نیست.');
}
console.log(`\nخروجی ماشین‌خوان: ${OUT}`);
console.log('توجه: `object` یعنی «بدنه یک شیء JSON است» — نه اعتبارسنجی مدل. این بدهی مستند است.');

process.exit(CHECK && missing.length ? 1 : 0);
