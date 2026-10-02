/*
 * تولید OpenAPI 3.1 از منبع حقیقت موجود — فاز ۱۲ (Production Readiness).
 *
 * چرا: `scripts/api-contract.mjs --json` همین حالا فهرست کامل مسیرها را می‌دهد
 * (method · path · auth · csrf · permission · bodyLimit · dto). OpenAPI فقط یک
 * **نمای استاندارد** از همان داده است، نه یک منبع حقیقت دوم. پس اینجا هیچ
 * قراردادی جعل نمی‌شود: هرچه در سند می‌آید از سورس استخراج شده است.
 *
 * اجرا:
 *   node scripts/openapi-generate.mjs            # می‌نویسد
 *   node scripts/openapi-generate.mjs --check    # فقط کهنه‌بودن را می‌سنجد (exit 1 اگر واگرا)
 *
 * خروجی: `docs/api/openapi.json` — بدون timestamp (تا drift قابل‌تشخیص باشد).
 *
 * کد خروج: ۰ سبز · ۱ واگرایی (فقط با --check) · ۲ خطای اجرا
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'docs', 'api', 'openapi.json');
const CHECK_ONLY = process.argv.includes('--check');

const { ROUTE_CONTRACTS } = await import('../database/apiContract/routeContracts.js');
const { ERROR_SPECS, statusFor } = await import('../database/apiContract/errorModel.js');

const contractRun = spawnSync(process.execPath, ['scripts/api-contract.mjs', '--json'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(contractRun.stdout);
} catch (error) {
  console.error('✗ خروجی JSON قرارداد API خوانده نشد:', error.message);
  process.exit(2);
}

/* نام کوکی سشن از سورس — نه رشتهٔ دست‌نویس. */
const { USER_SESSION_COOKIE } = await import('../database/userSessions.js');

const TAG_BY_API = {
  admin: 'admin', public: 'public', exam: 'exam', users: 'users', google: 'google',
};

/* OpenAPI مسیر پارامتری می‌خواهد؛ مسیرهای پروژه از قبل `:id` دارند ⇒ همان. */
const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const pathsOf = (path) => [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
  name: m[1], in: 'path', required: true, schema: { type: 'string' },
}));

/** بدنهٔ درخواست از نوع قراردادِ ثبت‌شده — بدون جعل schema دقیق. */
function requestBodyFor(route) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method)) return undefined;
  const contract = ROUTE_CONTRACTS[`${route.method} ${route.path}`];
  if (!contract) return undefined;
  if (contract.kind === 'none') {
    return { required: false, description: 'این مسیر بدنهٔ JSON ندارد (آپلود جریانی یا عملیات بدون payload).' };
  }
  const description = contract.kind === 'entity'
    ? `بدنهٔ سیم با Entity «${contract.entity}» (mode=${contract.mode}) اعتبارسنجی می‌شود.`
    : `فقط «بدنه یک شیء سادهٔ JSON» سنجیده می‌شود. ${contract.reason ?? ''}`.trim();
  return {
    required: true,
    description,
    content: {
      'application/json': {
        schema: contract.kind === 'entity'
          ? { $ref: '#/components/schemas/EntityInput' }
          : { $ref: '#/components/schemas/JsonObject' },
      },
    },
  };
}

function securityFor(route) {
  if (route.auth === 'session') return [{ sessionCookie: [] }];
  if (route.auth === 'public') return [];
  return [];
}

const paths = {};
for (const route of report.routes) {
  const openApiPath = toOpenApiPath(route.path);
  paths[openApiPath] ??= {};
  const errors = Object.keys(ERROR_SPECS)
    .map((code) => ({ code, status: statusFor(code) }))
    .filter((row) => row.status >= 400 && row.status < 500)
    .slice(0, 6);

  paths[openApiPath][route.method.toLowerCase()] = {
    operationId: `${route.method.toLowerCase()}${openApiPath.replace(/[^A-Za-z0-9]+/g, '_')}`,
    tags: [TAG_BY_API[route.api] ?? route.api],
    summary: `${route.method} ${route.path}`,
    parameters: pathsOf(route.path),
    security: securityFor(route),
    requestBody: requestBodyFor(route),
    'x-tapesh-api': route.api,
    'x-tapesh-auth': route.auth,
    'x-tapesh-csrf': route.csrf,
    'x-tapesh-permission': route.permission,
    'x-tapesh-permission-mode': route.permissionMode,
    'x-tapesh-body-limit': route.bodyLimit,
    'x-tapesh-dto': route.dto,
    responses: {
      200: {
        description: 'پاسخ موفق (پوشش پروژه: `{ success, data }` یا شیء دامنه‌ای)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } },
      },
      ...Object.fromEntries(errors.map((row) => [row.status, {
        description: `خطای مدل‌شده — نمونه کد: \`${row.code}\``,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      }])),
    },
  };
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Tapesh API',
    version: '1.0.0',
    description: [
      'این سند **تولیدشده** است: `node scripts/openapi-generate.mjs`.',
      'منبع حقیقت `scripts/api-contract.mjs --json` است؛ سند هیچ قراردادی از خود نمی‌سازد.',
      'schema بدنهٔ هر مسیر در `database/apiContract/routeContracts.js` ثبت شده است.',
      'کهنه‌بودن سند با `--check` سنجیده می‌شود (گام دروازه).',
    ].join('\n'),
  },
  /* دامنهٔ واقعی جعل نمی‌شود؛ سرور به‌صورت متغیر اعلام می‌شود. */
  servers: [{ url: '{baseUrl}', variables: { baseUrl: { default: 'http://localhost:4173', description: 'از PUBLIC_SITE_URL تنظیم کنید' } } }],
  tags: Object.values(TAG_BY_API).map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: USER_SESSION_COOKIE,
        description: 'کوکی سشن HttpOnly که سرور صادر می‌کند.',
      },
    },
    schemas: {
      JsonObject: { type: 'object', additionalProperties: true, description: 'شیء سادهٔ JSON (شکل دقیق در هندلر سنجیده می‌شود).' },
      EntityInput: { type: 'object', additionalProperties: true, description: 'بدنهٔ ورودی که با Schema مدل دامنه اعتبارسنجی می‌شود.' },
      SuccessEnvelope: {
        type: 'object',
        properties: { success: { type: 'boolean', const: true }, data: {} },
        required: ['success'],
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: Object.keys(ERROR_SPECS) },
              message: { type: 'string' },
            },
            required: ['code'],
          },
        },
        required: ['success', 'error'],
      },
    },
  },
  'x-tapesh-counts': report.counts,
};

const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (CHECK_ONLY) {
  if (!existsSync(TARGET)) {
    console.error(`✗ ${TARGET} وجود ندارد — ابتدا \`node scripts/openapi-generate.mjs\` را اجرا کنید.`);
    process.exit(1);
  }
  if (readFileSync(TARGET, 'utf8') !== serialized) {
    console.error('✗ سند OpenAPI کهنه است — با `node scripts/openapi-generate.mjs` بازتولید کنید.');
    process.exit(1);
  }
  console.log(`✓ OpenAPI هم‌گام است — ${report.routes.length} مسیر · ${Object.keys(paths).length} path`);
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, serialized, 'utf8');
console.log(`✓ نوشته شد: ${TARGET}`);
console.log(`  مسیرها: ${report.routes.length} · path: ${Object.keys(paths).length} · کد خطای مدل‌شده: ${Object.keys(ERROR_SPECS).length}`);
process.exit(0);
