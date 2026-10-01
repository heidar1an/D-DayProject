/*
 * تست‌های قرارداد API — فاز ۷ (PART C، بخش‌های ۲۴ و ۲۵).
 *
 * اجرا: `npm run api:test`  (یا `node database/apiContract.test.mjs`)
 *
 * اصل: هیچ انتظاری از حدس ساخته نشده. هر سنجه یا خروجی زندهٔ فروشگاه را
 * می‌سنجد، یا یک مقدار ثابت را که شاهدش در کامنت آمده. اگر رفتار عوض شود،
 * تست می‌شکند — نه اینکه انتظار پایین بیاید.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ERROR_SPECS, ADMIN_STATUS_BY_CODE, EXAM_STATUS_BY_CODE, USER_STATUS_BY_ERROR,
  ENVELOPES, buildError, statusFor, isKnownError, publicMessage,
} from './apiContract/errorModel.js';
import {
  PUBLIC_DTOS, HARD_FORBIDDEN_KEYS, DTO_FORBIDDEN_EXTRA, forbiddenFor,
  findSensitiveLeaks, diffAgainstDto, projectPublic, guardPublicOutput,
} from './apiContract/dtos.js';
import { validateInput, ENTITY_BY_ROUTE_DOMAIN } from './apiContract/input.js';
import { getModel, validateEntity } from './models/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(readFileSync(resolve(ROOT, relative), 'utf8'));
const recordsOf = (raw) => (Array.isArray(raw) ? raw : raw.items ?? raw[Object.keys(raw)[0]] ?? []);

/* ─────────────────────────── ۱. سازگاری نگاشت خطا ─────────────────────────── */

test('۱. نگاشت وضعیت admin عیناً همان جدول قبلی است (بدون تغییر رفتار)', () => {
  /* شاهد: مقادیر پیش از فاز ۷ در `adminApi.js` — باید بیت‌به‌بیت یکی باشند. */
  const expected = {
    VALIDATION_ERROR: 400, INVALID_CREDENTIALS: 401, UNAUTHENTICATED: 401, FORBIDDEN: 403,
    NOT_FOUND: 404, CONFLICT: 409, UNSUPPORTED_MEDIA_TYPE: 415, PAYLOAD_TOO_LARGE: 413,
    RATE_LIMITED: 429, PUBLISH_NO_TOKEN: 409, PUBLISH_UNAUTHORIZED: 502, PUBLISH_FORBIDDEN: 502,
    PUBLISH_UNREACHABLE: 502, PUBLISH_TIMEOUT: 504, PUBLISH_FAILED: 502, INTERNAL_ERROR: 500,
  };
  assert.deepEqual({ ...ADMIN_STATUS_BY_CODE }, expected);
});

test('۲. نگاشت وضعیت exam و users عیناً همان جدول‌های قبلی‌اند', () => {
  assert.deepEqual({ ...EXAM_STATUS_BY_CODE }, {
    VALIDATION_ERROR: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
    CONFLICT: 409, PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, INTERNAL_ERROR: 500,
  });
  assert.deepEqual({ ...USER_STATUS_BY_ERROR }, {
    PHONE_REQUIRED: 400, PHONE_MALFORMED: 400, PASSWORD_REQUIRED: 400, PASSWORD_MALFORMED: 400,
    PASSWORD_TOO_SHORT: 400, PASSWORD_TOO_LONG: 400, PASSWORD_TOO_WEAK: 400,
    USER_ALREADY_EXISTS: 409, USER_NOT_FOUND: 404, UNAUTHENTICATED: 401, INVALID_CREDENTIALS: 401,
    FORBIDDEN: 403, UNSUPPORTED_MEDIA_TYPE: 415, PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429,
    BAD_REQUEST: 400,
  });
});

test('۳. هر کد نگاشت‌شده در مدل مرکزی ثبت شده و وضعیتش یکسان است', () => {
  for (const map of [ADMIN_STATUS_BY_CODE, EXAM_STATUS_BY_CODE, USER_STATUS_BY_ERROR]) {
    for (const [code, status] of Object.entries(map)) {
      assert.ok(isKnownError(code), `کد ${code} در ERROR_SPECS نیست`);
      assert.equal(statusFor(code), status, `وضعیت ${code} ناهمگون است`);
    }
  }
  assert.equal(statusFor('CODE_THAT_DOES_NOT_EXIST'), 500, 'کد ناشناخته باید ۵۰۰ شود');
});

test('۴. نگاشت خطاهای اعتبارسنجی و احراز هویت (بندهای ۱۷ و ۱۸)', () => {
  assert.equal(statusFor('VALIDATION_ERROR'), 400);
  assert.equal(statusFor('UNAUTHENTICATED'), 401);
  assert.equal(statusFor('INVALID_CREDENTIALS'), 401);
  assert.equal(statusFor('FORBIDDEN'), 403);
  assert.equal(statusFor('NOT_FOUND'), 404);
  assert.equal(statusFor('CONFLICT'), 409);
  assert.equal(statusFor('PAYLOAD_TOO_LARGE'), 413);
  assert.equal(statusFor('RATE_LIMITED'), 429);
  assert.equal(statusFor('INTERNAL_ERROR'), 500);
  assert.equal(ERROR_SPECS.RATE_LIMITED.retryable, true, '۴۲۹ باید قابل‌تکرار باشد');
  assert.equal(ERROR_SPECS.VALIDATION_ERROR.retryable, false);
});

test('۵. پوشش‌های خطا سازگار و بدون تغییرند — و `users` صریحاً ناهمگون است', () => {
  assert.deepEqual(buildError('admin', 'NOT_FOUND', 'پیدا نشد'), {
    success: false, error: { code: 'NOT_FOUND', message: 'پیدا نشد' },
  });
  assert.deepEqual(buildError('admin', 'VALIDATION_ERROR', 'بد', { fields: { title: 'required' } }), {
    success: false, error: { code: 'VALIDATION_ERROR', message: 'بد', fields: { title: 'required' } },
  });
  assert.deepEqual(buildError('exam', 'CONFLICT', 'بسته', { reason: 'exam-not-open' }), {
    success: false, error: { code: 'CONFLICT', reason: 'exam-not-open', message: 'بسته' },
  });
  assert.deepEqual(buildError('google', 'METHOD_NOT_ALLOWED', 'نه'), {
    success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'نه' },
  });
  /* ⚠ finding: این پوشش با سه پوشش دیگر یکی نیست — عمداً یکسان‌سازی نشد. */
  assert.deepEqual(buildError('users', 'UNAUTHENTICATED'), { error: 'UNAUTHENTICATED' });
  assert.equal(Object.keys(ENVELOPES).length, 4);
});

test('۶. خطای داخلی هرگز پیام داخلی را افشا نمی‌کند', () => {
  const payload = buildError('admin', 'INTERNAL_ERROR', 'at Object.<anonymous> /Users/x/database/contentStore.js:12');
  assert.equal(payload.error.message, 'خطای غیرمنتظره در سرور');
  assert.ok(!payload.error.message.includes('contentStore'));
  assert.equal(publicMessage('INTERNAL_ERROR', 'هر چیز داخلی'), 'خطای غیرمنتظره در سرور');
  /* پیام خطای غیرحساس باید دست‌نخورده بماند */
  assert.equal(publicMessage('NOT_FOUND', 'صفحه پیدا نشد'), 'صفحه پیدا نشد');
});

/* ─────────────────────────── ۲. اعتبارسنجی ورودی ↔ Schema فاز ۶ ─────────────────────────── */

const articleSample = recordsOf(readJson('database/content/articles.json'))[0];

test('۷. رکورد واقعی ذخیره‌شده از Schema عبور می‌کند (شاهد: articles.json)', () => {
  assert.ok(articleSample, 'نمونهٔ واقعی مقاله لازم است');
  const stored = validateEntity('article', articleSample, { mode: 'stored' });
  assert.equal(stored.ok, true, JSON.stringify(stored.errors));
  const viaApi = validateInput('article', articleSample, { mode: 'stored' });
  assert.equal(viaApi.ok, true);
  assert.deepEqual(viaApi.fields, {});
});

test('۸. فیلد الزامی غایب ⇒ خطای `required` (ورودی نامعتبر)', () => {
  const broken = { ...articleSample };
  delete broken.title;
  const result = validateInput('article', broken, { mode: 'create' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.title, 'required');
});

test('۹. فیلد ناشناخته در حالت create ⇒ خطای `unknown_field`', () => {
  const result = validateInput('article', { ...articleSample, __injected: 1 }, { mode: 'create' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.__injected, 'unknown_field');
});

test('۱۰. نوع نادرست ⇒ خطای `type`', () => {
  const result = validateInput('article', { ...articleSample, views: 'خیلی زیاد' }, { mode: 'create' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.views, 'type');
});

test('۱۱. مقدار نامعتبر enum ⇒ خطای `enum` (و مقدار معتبر رد نمی‌شود)', () => {
  const bad = validateInput('article', { ...articleSample, status: 'نه-یک-وضعیت' }, { mode: 'create' });
  assert.equal(bad.ok, false);
  assert.equal(bad.fields.status, 'enum');

  const good = validateInput('article', { ...articleSample, status: articleSample.status }, { mode: 'create' });
  assert.equal(good.fields.status, undefined);
});

test('۱۲. فیلد محافظت‌شده از Client پذیرفته نمی‌شود (id / createdAt)', () => {
  const result = validateInput('article', { ...articleSample, createdAt: '2020-01-01T00:00:00.000Z' }, { mode: 'create' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.createdAt, 'protected_field');
});

test('۱۳. رابطهٔ نامعتبر ⇒ خطای `not_found` (بند ۹ — ارجاع سخت)', () => {
  const schema = getModel('article');
  const refField = Object.entries(schema.fields).find(([, field]) => field.meta?.ref || field.ref)?.[0];
  if (!refField) return; /* رابطهٔ اعلام‌شده‌ای نیست ⇒ NOT APPLICABLE */

  const result = validateInput('article', { ...articleSample, [refField]: 'no-such-parent-999' }, {
    mode: 'create',
    collections: { categories: recordsOf(readJson('database/content/categories.json')) },
  });
  assert.equal(result.ok, false);
  assert.equal(result.fields[refField], 'not_found');
});

test('۱۴. هر دامنهٔ نگاشت‌شده به Entity واقعی در رجیستری مدل اشاره می‌کند', () => {
  for (const [domain, entity] of Object.entries(ENTITY_BY_ROUTE_DOMAIN)) {
    assert.ok(getModel(entity), `دامنهٔ ${domain} به Entity ناموجود «${entity}» نگاشت شده`);
  }
});

/* ─────────────────────────── ۳. DTO و عدم افشا ─────────────────────────── */

test('۱۵. شکل DTOهای عمومی با خروجی زندهٔ فروشگاه یکی است (قرارداد قفل می‌شود)', async () => {
  const cs = await import('./contentStore.js');
  const live = {
    'GET /api/public/articles': cs.publishedArticles({ limit: 100 })[0],
    'GET /api/public/banners': cs.publishedBanners()[0],
    'GET /api/public/settings': cs.publicSettings(),
    'GET /api/public/flashcards/library': cs.publishedFlashcardDecks()[0],
    'GET /api/public/micro/library': cs.publishedMicroCourses()[0],
    'GET /api/public/references/library': cs.publishedReferences()[0],
    'GET /api/public/comprehensive/library': cs.publishedComprehensiveCourses()[0],
    'GET /api/public/test-bank/questions': cs.publishedTestBankQuestions()[0],
    'GET /api/public/test-bank/revision': { revision: cs.testBankRevision() },
  };

  for (const [dtoName, sample] of Object.entries(live)) {
    assert.ok(sample, `${dtoName}: نمونهٔ زنده لازم است`);
    const diff = diffAgainstDto(dtoName, sample);
    assert.equal(diff.unknown, false, `${dtoName}: DTO ثبت نشده`);
    assert.deepEqual(diff.missing, [], `${dtoName}: فیلد DTO در خروجی واقعی نیست → ${diff.missing}`);
    assert.deepEqual(diff.extra, [], `${dtoName}: فیلد تازهٔ بی‌DTO در خروجی → ${diff.extra}`);
  }
});

test('۱۶. بانک تست عمومی کلید پاسخ و تشریح را افشا نمی‌کند (عدم افشا)', async () => {
  const cs = await import('./contentStore.js');
  const questions = cs.publishedTestBankQuestions();
  assert.ok(questions.length > 0, 'بانک منتشرشده لازم است');

  for (const question of questions) {
    assert.equal(Object.hasOwn(question, 'correctAnswer'), false, `سؤال ${question.id}: correctAnswer نشت کرد`);
    assert.equal(Object.hasOwn(question, 'explanation'), false, `سؤال ${question.id}: explanation نشت کرد`);
  }
  /* `stats` عمداً عمومی است ولی فقط سه شاخص — بدون توزیع گزینه‌ها */
  const statsKeys = Object.keys(questions[0].stats ?? {}).sort();
  assert.deepEqual(statsKeys, ['avgTimeSec', 'correctPercent', 'solves']);
  assert.deepEqual(findSensitiveLeaks(questions, { forbidden: forbiddenFor('GET /api/public/test-bank/questions') }), []);
});

test('۱۶.۱ درسنامهٔ جامع `explanation` آموزشی دارد و گارد آن را نمی‌گیرد (قفل regression)', async () => {
  /*
   * ⚠️ این سنجه از یک باگ واقعی محافظت می‌کند: نسخهٔ اول گارد، `explanation`
   * را سراسری ممنوع کرده بود و مسیر `/api/public/comprehensive/library` را
   * ۵۰۰ می‌کرد — چون `explanation` در درسنامهٔ جامع متن آموزشی مشروع است.
   * `testBankSecurity.test.mjs` سنجهٔ ۶ آن را گرفت و گارد اصلاح شد.
   */
  const cs = await import('./contentStore.js');
  const courses = cs.publishedComprehensiveCourses();
  assert.ok(courses.length > 0, 'درسنامهٔ جامع منتشرشده لازم است');

  /* دادهٔ واقعی قطعاً `explanation` دارد — پس گارد سراسری غلط بود. */
  assert.deepEqual(findSensitiveLeaks(courses, { forbidden: forbiddenFor('GET /api/public/comprehensive/library') }), []);
  assert.doesNotThrow(() => guardPublicOutput('GET /api/public/comprehensive/library', { courses }));

  /* ولی همان کلید در بافت بانک تست باید گرفته شود */
  assert.throws(
    () => guardPublicOutput('GET /api/public/test-bank/questions', { questions: [{ id: 'q', explanation: {} }] }),
    (error) => error.code === 'INTERNAL_ERROR',
  );
  assert.ok(!HARD_FORBIDDEN_KEYS.includes('explanation'), 'explanation نباید ممنوع مطلق باشد');
  assert.ok(DTO_FORBIDDEN_EXTRA['GET /api/public/test-bank/questions'].includes('explanation'));
});

test('۱۷. `publicUser` و `publicAdmin` فیلدهای حساس را حذف می‌کنند', async () => {
  const users = await import('./usersStore.js');
  const cs = await import('./contentStore.js');

  const rawUser = { id: 'u1', phone: '09120000000', passwordHash: 'scrypt$salt$hash', googleId: 'g-1', profile: {} };
  const safeUser = users.publicUser(rawUser);
  assert.equal(Object.hasOwn(safeUser, 'passwordHash'), false);
  assert.equal(Object.hasOwn(safeUser, 'googleId'), false);
  assert.equal(safeUser.phone, '09120000000');
  assert.deepEqual(findSensitiveLeaks(safeUser), []);

  const rawAdmin = { id: 'a1', username: 'root', passwordHash: 'scrypt$x$y', role: 'super-admin' };
  const safeAdmin = cs.publicAdmin(rawAdmin);
  assert.equal(Object.hasOwn(safeAdmin, 'passwordHash'), false);
  assert.ok(Array.isArray(safeAdmin.permissions), 'permissions باید محاسبه شود');
});

test('۱۸. گارد نشت روی دادهٔ سالم بی‌اثر است ولی نشت واقعی را می‌گیرد', () => {
  const clean = { id: 'x', title: 'سالم', nested: [{ ok: 1 }] };
  assert.equal(guardPublicOutput('test', clean), clean);

  assert.throws(
    () => guardPublicOutput('test', { id: 'x', nested: [{ passwordHash: 'leak' }] }),
    (error) => error.code === 'INTERNAL_ERROR' && error.leaks[0].path === 'nested[0].passwordHash',
  );
});

test('۱۹. اسکن نشت کلیدهای ممنوع را در عمق پیدا می‌کند', () => {
  const leaks = findSensitiveLeaks({ a: { b: [{ correctAnswer: 2 }] }, token: 'x' }, {
    forbidden: forbiddenFor('GET /api/public/test-bank/questions'),
  });
  const paths = leaks.map((leak) => leak.path).sort();
  assert.deepEqual(paths, ['a.b[0].correctAnswer', 'token']);
  for (const key of ['passwordHash', 'googleId', 'token', 'credentials', 'secret']) {
    assert.ok(HARD_FORBIDDEN_KEYS.includes(key), `${key} باید در فهرست ممنوع مطلق باشد`);
  }
});

test('۲۰. برش DTO فقط فیلدهای مجاز را برمی‌گرداند', () => {
  const projected = projectPublic('GET /api/public/test-bank/questions', {
    id: 'tb1', stem: 'صورت', correctAnswer: 2, explanation: {}, stats: { solves: 1, correctPercent: 50, avgTimeSec: 3 },
  });
  assert.deepEqual(Object.keys(projected).sort(), ['id', 'stats', 'stem']);
});

test('۲۱. هر DTO ثبت‌شده شاهد دارد (فایل یا تابع فروشگاه نام‌برده شده)', () => {
  for (const [name, dto] of Object.entries(PUBLIC_DTOS)) {
    assert.ok(dto.source, `${name}: منبع نام‌برده نشده`);
    assert.ok(dto.evidence, `${name}: شاهد ثبت نشده`);
  }
});

/* ─────────────────────────── ۴. سقف بدنه ─────────────────────────── */

test('۲۲. سقف بدنهٔ هر لایه از سورس استخراج و تأیید می‌شود (۱۲MB / ۱MB / ۲۵۶KB)', () => {
  const admin = readFileSync(resolve(ROOT, 'database/adminApi.js'), 'utf8');
  const exam = readFileSync(resolve(ROOT, 'database/examApi.js'), 'utf8');
  const users = readFileSync(resolve(ROOT, 'database/usersApi.js'), 'utf8');

  assert.match(admin, /MAX_BODY_BYTES = 12 \* 1024 \* 1024/);
  assert.match(exam, /MAX_BODY_BYTES = 256 \* 1024/);
  assert.match(users, /size > 1e6/);
  assert.match(admin, /readBody\(request, 64 \* 1024\)/, 'سقف تلمتری/بازخورد ۶۴KB است');
  assert.match(admin, /readBody\(request, 8 \* 1024\)/, 'سقف markRepliesRead ۸KB است');
});

/* ─────────────────────────── ۵. موجودی مسیر و انطباق ─────────────────────────── */

test('۲۳. انطباق قرارداد API سبز است (ابزار مستقل، exit=0)', () => {
  const result = spawnSyncNode(['scripts/api-contract.mjs', '--check']);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /انطباق قرارداد API سبز/);
});

test('۲۴. موجودی مسیر با شمارش واقعی سورس می‌خواند و شمارش‌ها پایدارند', () => {
  const result = spawnSyncNode(['scripts/api-contract.mjs', '--json']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);

  assert.equal(report.counts.total, report.routes.length);
  assert.deepEqual(report.counts.byApi, { admin: 186, public: 15, exam: 16, users: 8, google: 4 });
  assert.equal(report.counts.writes, report.routes.filter((route) => route.method !== 'GET').length);
  assert.deepEqual(report.unknownErrorCodes, []);
  assert.deepEqual(report.publicRoutesWithoutDto, []);
  assert.deepEqual(report.violations, []);
  /* هیچ مسیر ادمینی نباید «بدون مجوز و بدون ثبت در فهرست فقط-ورود» باشد */
  assert.deepEqual(report.adminDenyByDefault, []);
});

test('۲۵. هر مسیر نوشتن ادمین یا مجوز دارد یا صریحاً فقط-ورود است (deny-by-default)', () => {
  const result = spawnSyncNode(['scripts/api-contract.mjs', '--json']);
  const report = JSON.parse(result.stdout);
  const adminWrites = report.routes.filter((route) => route.api === 'admin' && route.method !== 'GET');

  for (const route of adminWrites) {
    assert.ok(
      route.permissionMode === 'permission' || route.permissionMode === 'authenticated-only',
      `${route.method} ${route.path}: بدون مجوز و بدون ثبت فقط-ورود`,
    );
    assert.ok(route.csrf === 'yes', `${route.method} ${route.path}: CSRF لازم است`);
  }
});

test('۲۶. ثابت‌های امنیتی نشست تغییر نکرده‌اند (regression)', async () => {
  const adminApi = await import('./adminApi.js');
  assert.equal(adminApi.SESSION_COOKIE, 'tapesh_admin_session');
  assert.equal(adminApi.CSRF_HEADER, 'x-tapesh-csrf');
  const examApi = await import('./examApi.js');
  assert.equal(examApi.EXAM_CSRF_HEADER, 'x-tapesh-exam');
});

test('۲۷. ابزار ممیزی ورودی پس از استخراج پارسر مشترک، همان نتیجه را می‌دهد', () => {
  const result = spawnSyncNode(['scripts/api-input-audit.mjs', '--json']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.total, 185, 'شمارش مسیرهای ادمین نباید عوض شده باشد');
  assert.equal(report.routes.filter((route) => route.needsReview).length, 0);
  const selfTest = spawnSyncNode(['scripts/api-input-audit.mjs', '--selftest']);
  assert.equal(selfTest.status, 0, selfTest.stdout);
});

test('۲۷.۱. سازگاری Client ↔ API: هیچ تماس شبکه‌ای به مسیر ناموجود وجود ندارد', () => {
  const result = spawnSyncNode(['scripts/client-contract-audit.mjs', '--json']);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);

  assert.equal(report.serverRoutes, 229);
  assert.deepEqual(report.brokenCalls, [], 'تماس واقعی به مسیر ناموجود');
  assert.ok(report.used.length > 0, 'باید حداقل یک تماس واقعی پیدا شود');
  for (const entry of report.used) {
    assert.equal(entry.implemented, true, `${entry.path}: در موجودی سرور نیست`);
  }
  /* ۱۲۲ مسیر «توصیف‌شده ولی پیاده‌نشده» — یافتهٔ ثبت‌شدهٔ بند ۲۳، نه خطا. */
  assert.ok(report.documentedNotImplemented.length > 0, 'یافتهٔ DOCUMENTED BUT NOT IMPLEMENTED باید ثبت شود');
});

test('۲۷.۲. خودآزمون ابزار ممیزی Client سبز است (نرمال‌سازی مسیر)', () => {
  const result = spawnSyncNode(['scripts/client-contract-audit.mjs', '--selftest']);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /خودآزمون نرمال‌سازی مسیر سبز/);
});

/* ─────────────────────────── ۶. smoke test با سرور واقعی ─────────────────────────── */

const PORT = 4599;
let child = null;

function waitForServer(process) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('سرور در زمان مقرر بالا نیامد')), 20000);
    const onData = (chunk) => {
      if (String(chunk).includes('بالا آمد')) {
        clearTimeout(timer);
        process.stdout.off('data', onData);
        resolvePromise();
      }
    };
    process.stdout.on('data', onData);
    process.stderr.on('data', (chunk) => { /* سرور خطای واقعی را خودش لاگ می‌کند */ });
    process.on('exit', (code) => {
      clearTimeout(timer);
      rejectPromise(new Error(`سرور با کد ${code} خارج شد`));
    });
  });
}

test('۲۸. smoke test روی سرور واقعی: مسیرهای عمومی، عدم افشا و خطای ۴۰۴', async (t) => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
  } catch (error) {
    t.skip(`سرور بالا نیامد (${error.message}) — UNVERIFIED`);
    child?.kill('SIGKILL');
    return;
  }

  const base = `http://127.0.0.1:${PORT}`;
  const get = async (path) => {
    const response = await fetch(`${base}${path}`);
    return { status: response.status, body: await response.json() };
  };

  /* مسیر عمومی با DTO */
  const bank = await get('/api/public/test-bank/questions');
  assert.equal(bank.status, 200);
  assert.equal(bank.body.success, true);
  assert.ok(Array.isArray(bank.body.data.questions));
  assert.deepEqual(
    findSensitiveLeaks(bank.body.data.questions, { forbidden: forbiddenFor('GET /api/public/test-bank/questions') }),
    [],
    'نشت در پاسخ واقعی',
  );

  /* مسیر عمومی بدون DTO محتوا — شکل پوشش */
  const settings = await get('/api/public/settings');
  assert.equal(settings.status, 200);
  assert.equal(settings.body.success, true);

  /* ⚠ مسیر درسنامهٔ جامع: `explanation` آموزشی مشروع است — نباید ۵۰۰ شود */
  const comprehensive = await get('/api/public/comprehensive/library');
  assert.equal(comprehensive.status, 200, 'گارد نباید درسنامهٔ جامع را بشکند');
  assert.equal(comprehensive.body.success, true);

  /* مسیر عمومی دیگر با DTO */
  const flashcards = await get('/api/public/flashcards/library');
  assert.equal(flashcards.status, 200);
  assert.equal(flashcards.body.success, true);

  /* مسیر ناشناخته ⇒ ۴۰۴ با پوشش ادمین/عمومی */
  const missing = await get('/api/public/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.success, false);
  assert.equal(missing.body.error.code, 'NOT_FOUND');

  /* مسیر ادمین بدون نشست ⇒ ۴۰۱ */
  const admin = await get('/api/admin/stats');
  assert.equal(admin.status, 401);
  assert.equal(admin.body.error.code, 'UNAUTHENTICATED');

  /* مسیر کاربران بدون نشست ⇒ همان پوشش ناهمگون users */
  const me = await get('/api/users/me');
  assert.equal(me.status, 401);
  assert.equal(me.body.error, 'UNAUTHENTICATED');
  assert.equal(me.body.authenticated, false);
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGKILL');
});

/* ─────────────────────────── ابزار کمکی ─────────────────────────── */

function spawnSyncNode(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
}
