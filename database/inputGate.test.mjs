/*
 * تست دروازهٔ ورودی API (فاز ۱۲ پیشنهادی — بند ۱ و ۲).
 *
 * بدهی ثبت‌شده: `database/apiContract/input.js` پل اعتبارسنجی را آماده کرده بود ولی
 * **هیچ مسیری** آن را صدا نمی‌زد (۰ از ۱۱۷ مسیر نوشتن). این فایل سیم‌کشی نمونهٔ
 * اثباتی را قفل می‌کند: دو مسیر یادداشت.
 *
 * چرا `mode: 'patch'`؟ چون `id` / `authorId` / `createdAt` سمت سرور ساخته می‌شوند و
 * در بدنهٔ درخواست نیستند؛ در `create` این فیلدهای الزامی همیشه خطا می‌دادند و
 * دروازه به یک مسیر همیشه‌شکست‌خورده تبدیل می‌شد. `patch` فقط فیلدهای **ارسال‌شده**
 * را می‌سنجد.
 *
 * چرا مسیر یادداشت؟ سه شرط لازم برای «کوچک‌ترین تغییر قابل‌اثبات»:
 *   ۱) کلاینت وب این مسیر را صدا نمی‌زند (`src/` هیچ `api/admin/notes` ندارد) ⇒
 *      سخت‌گیرشدن نمی‌تواند رابط کاربری زنده را بشکند.
 *   ۲) سوییت موجود `adminApi.test.mjs` این مسیر را واقعاً اجرا می‌کند (ساخت، تیک،
 *      حذف) ⇒ رگرسیون‌شکنی فوراً دیده می‌شود.
 *   ۳) قرارداد خطا دست‌نخورده می‌ماند: همان `VALIDATION_ERROR` که `createNote`
 *      از قبل برای یادداشت خالی پرتاب می‌کند و تست موجود آن را ۴۰۰ می‌بیند.
 *
 * اجرا: `node --test database/inputGate.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ADMIN_STATUS_BY_CODE, publicMessage } from './apiContract/errorModel.js';
import { assertInputValid, validateInput } from './apiContract/input.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_API_SOURCE = readFileSync(resolve(HERE, 'adminApi.js'), 'utf8');

/* ── ۱) اثبات ساختاری: دروازه واقعاً در هندلرها سیم‌کشی شده ───────────────── */

test('ساختاری: `assertInputValid` از ماژول قرارداد import شده است', () => {
  assert.match(ADMIN_API_SOURCE, /import \{ assertInputValid \} from '\.\/apiContract\/input\.js'/);
});

test('ساختاری: هر دو مسیر نوشتن یادداشت دروازهٔ ورودی دارند', () => {
  const post = ADMIN_API_SOURCE.match(/'POST', '\/api\/admin\/notes', 'notes\.create', async \(ctx\) => \{[\s\S]*?\n  \}\]/)?.[0] ?? '';
  const put = ADMIN_API_SOURCE.match(/'PUT', '\/api\/admin\/notes\/:id', 'notes\.update', async \(ctx\) => \{[\s\S]*?\n  \}\]/)?.[0] ?? '';
  assert.match(post, /assertInputValid\('note', ctx\.body, \{ mode: 'patch' \}\)/, 'دروازهٔ POST یادداشت حذف شده');
  assert.match(put, /assertInputValid\('note', ctx\.body, \{ mode: 'patch' \}\)/, 'دروازهٔ PUT یادداشت حذف شده');
});

test('ساختاری: سیم‌کشی عمداً محدود است (سراسری نشده)', () => {
  const calls = [...ADMIN_API_SOURCE.matchAll(/assertInputValid\(/g)].length;
  assert.equal(calls, 2, `انتظار ۲ فراخوانی بود، ${calls} پیدا شد — گسترش باید آگاهانه و با تست باشد`);
});

/* ── ۲) قرارداد خطا: کد خطا همان چیزی است که مرز API می‌فهمد ────────────── */

test('قرارداد: `VALIDATION_ERROR` ⇒ وضعیت ۴۰۰ و پیام افشاشده', () => {
  assert.equal(ADMIN_STATUS_BY_CODE.VALIDATION_ERROR, 400);
  assert.equal(publicMessage('VALIDATION_ERROR', 'پیام دقیق فیلدها'), 'پیام دقیق فیلدها');
  /* آزمون غیر‌واقعی نبودن: کدهای `expose:false` باید پیام را عوض کنند، وگرنه
     سنجهٔ بالا هر کدی را قبول می‌کرد. */
  assert.notEqual(publicMessage('INTERNAL_ERROR', 'جزئیات داخلی'), 'جزئیات داخلی');
});

/* ── ۳) اثبات رفتاری: دروازه چه می‌گیرد و چه نمی‌گیرد ───────────────────── */

test('رفتاری: بدنهٔ معتبر یادداشت چک‌لیستی از دروازه می‌گذرد', () => {
  const result = assertInputValid('note', {
    title: 'یادداشت تست',
    kind: 'checklist',
    items: [{ text: 'کار اول' }, { text: 'کار دوم' }],
  }, { mode: 'patch' });
  assert.equal(result.ok, true);
});

test('رفتاری: بدنهٔ خالی از دروازه می‌گذرد (رد آن کار `createNote` است، نه دروازه)', () => {
  /* تست موجود `adminApi.test.mjs` انتظار ۴۰۰ برای یادداشت خالی دارد؛ آن ۴۰۰ باید
     از `createNote` بیاید تا قرارداد فعلی دست‌نخورده بماند. */
  assert.equal(assertInputValid('note', { title: '', body: '' }, { mode: 'patch' }).ok, true);
});

test('رفتاری: `kind` ناشناخته رد می‌شود و مسیر فیلد گزارش می‌شود', () => {
  const result = validateInput('note', { title: 'x', kind: 'bogus' }, { mode: 'patch' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.kind, 'enum');
});

test('رفتاری: نوع نادرست رد می‌شود', () => {
  const result = validateInput('note', { title: { nested: true } }, { mode: 'patch' });
  assert.equal(result.ok, false);
  assert.equal(result.fields.title, 'type');
});

/*
 * ⚠️ محدودیت شناخته‌شده و عمداً قفل‌شده:
 * در `validator.js:209` تشخیص کلید ناشناخته فقط در `mode === 'create'` (یا برای
 * Entityهای `STRICT_UNKNOWN_FIELD_ENTITIES`) فعال است. پس دروازهٔ ما در حالت
 * `patch` **کلید ناشناخته را نمی‌گیرد**. این تست رفتار فعلی را مستند می‌کند تا
 * کسی بی‌دلیل فرض نکند دروازه allowlist است؛ و نشان می‌دهد مکانیزم وجود دارد و
 * فقط انتخاب mode آن را خاموش کرده. سخت‌گیرکردن `patch` یک تغییر مشترک در
 * `validator.js` است (اثر روی اسکنر `data:check` و همهٔ Entityها) ⇒ نیازمند
 * تصمیم صریح، نه تغییر ضمنی.
 */
test('محدودیت مستند: در `patch` کلید ناشناخته رد نمی‌شود، ولی در `create` می‌شود', () => {
  const patch = validateInput('note', { title: 'x', totallyUnknown: 1 }, { mode: 'patch' });
  assert.equal(patch.ok, true, 'رفتار فعلی عوض شده — اگر عمدی است این تست را به‌روز کن');

  const create = validateInput('note', { title: 'x', totallyUnknown: 1 }, { mode: 'create' });
  assert.equal(create.ok, false);
  assert.equal(create.fields.totallyUnknown, 'unknown_field');
});

test('رفتاری: خطای پرتاب‌شده دقیقاً شکل `{code, fields}` را دارد', () => {
  let thrown = null;
  try {
    assertInputValid('note', { kind: 'bogus' }, { mode: 'patch' });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'انتظار پرتاب خطا بود');
  assert.equal(thrown.code, 'VALIDATION_ERROR');
  assert.ok(thrown.fields && typeof thrown.fields === 'object', 'fields باید شیء مسیر→خطا باشد');
  assert.ok(!/\bat\s+\w+/.test(String(thrown.stack ?? '').split('\n')[0]), 'پیام نباید stack باشد');
});

/* ── ۴) مرز: Entity ناشناخته نباید بی‌صدا قبول شود ───────────────────────── */

test('امنیت: فیلدهای سرورساز در ورودی کلاینت رد می‌شوند', () => {
  const withId = validateInput('note', { id: 'note-hack' }, { mode: 'patch' });
  assert.equal(withId.ok, false);
  assert.equal(withId.fields.id, 'protected_field');

  const withCreated = validateInput('note', { createdAt: '2000-01-01' }, { mode: 'patch' });
  assert.equal(withCreated.ok, false);
  assert.equal(withCreated.fields.createdAt, 'protected_field');
});

/*
 * محدودیت مستند: `authorId` در Schema محافظت‌شده نیست، پس دروازه آن را می‌پذیرد.
 * آسیب‌پذیری نیست چون `createNote`/`updateNote` مقدار `authorId` را از بازیگر
 * احراز‌هویت‌شده بازنویسی می‌کنند؛ ولی اگر روزی آن بازنویسی برداشته شود، این
 * تست می‌شکند و یادآوری می‌کند که دروازه جلوی جعل نویسنده را نمی‌گیرد.
 */
test('محدودیت مستند: `authorId` محافظت‌شده نیست و انبار آن را بازنویسی می‌کند', () => {
  assert.equal(validateInput('note', { authorId: 'adm-x' }, { mode: 'patch' }).ok, true);
});

test('مرز: Entity ناشناخته خطای صریح می‌دهد', () => {
  const result = validateInput('does-not-exist', { a: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'unknown_entity');
});
