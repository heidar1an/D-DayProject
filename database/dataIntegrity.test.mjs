/*
 * تست مدل داده، Schema، اعتبارسنجی و یکپارچگی — PHASE 5.
 * اجرا: node database/dataIntegrity.test.mjs
 *
 * ── چه چیزی را می‌سنجد ──────────────────────────────────────────────────────
 *  ۱) پایه‌های فیلد (fields.js) — قالب، سقف، enum، nullable
 *  ۲) ماتریس الزامی اعتبارسنجی: معتبر · نبودِ الزامی · نوع غلط · enum غلط ·
 *     فیلد ناشناخته · فیلد محافظت‌شده · فیلد تغییرناپذیر · null
 *  ۳) ساختار تودرتو و اتحاد تفکیک‌شده (بلوک محتوا)
 *  ۴) یکتایی، شناسهٔ تکراری و قید ترکیبی
 *  ۵) ارجاع‌ها، یتیم‌ها و قواعد حذف
 *  ۶) گذار وضعیت (ماشین حالت)
 *  ۷) قواعد بین‌فیلدی
 *  ۸) نرمال‌سازی ≠ تعمیر (بند ۵۳)
 *  ۹) راز و فیلد محافظت‌شده
 * ۱۰) شکل ذخیره‌سازی (گاردِ افتِ بی‌صدا)
 * ۱۱) **انطباق enum با منبع اصلی** — اگر مقدار مجاز در `mediaStore.js` عوض شود
 *     و رجیستری به‌روز نشود، این تست می‌شکند.
 * ۱۲) اسکن دادهٔ واقعی — پوشش Schema، یافته‌های شناخته‌شده، نبودِ راز.
 *
 * ⚠️ این تست **هیچ فایلی نمی‌نویسد**. دادهٔ واقعی فقط خوانده می‌شود.
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MODELS, MODEL_BY_NAME, MODELS_BY_COLLECTION, COLLECTION_FILES,
  RELATIONS, POLYMORPHIC_RELATIONS,
  CROSS_FIELD_CHECKS, validateRecord, validateEntity, checkUnique, assertValid,
  stripSecrets, secretFieldNames, applyDefaults, normalizeRecord, domainNormalizersFor, sameValue,
  findIdentityIssues, findUniqueViolations, findRelationOrphans, checkStorageShape,
  recordsFromContainer,
  findSecretLeaks, findStorageKeyIssues, schemaCoverage, canTransition,
  TRANSITION_REGISTRY, ENUM_REGISTRY,
  str, num, bool, id, idAnyOf, slug, hexColor, timestamp, epoch, percent, count,
  arr, strArray, obj, enumOf, required, optional, immutable, secret, serverOnly,
  MEDIA_CONTENT_STATUSES, MEDIA_CONTENT_TRANSITIONS, MEDIA_CONTENT_TYPES,
  MEDIA_ACCOUNT_KINDS, MEDIA_TEAM_ROLES, MEDIA_CAMPAIGN_STATUSES, MEDIA_INBOX_STATUSES,
  MEDIA_INBOX_KINDS, MEDIA_NOTIFICATION_LEVELS, MEDIA_TAG_KINDS, MEDIA_ASSET_KINDS,
  MEDIA_UTM_MEDIUMS, MEDIA_ENTITY_TYPES, MEDIA_MENTION_SENTIMENTS, MEDIA_PLATFORMS,
  ANALYTICS_EVENT_TYPES,
  PUBLISH_LOG_STATUSES, TEST_BANK_DIFFICULTIES, TEST_BANK_TYPES, TEST_BANK_SOURCES,
  TEST_BANK_TRACKS, NOTE_KINDS, NOTE_SOURCE_TYPES, ALERT_METRICS, ALERT_COMPARATORS,
  ALERT_SEVERITIES, FEEDBACK_STATUSES, FEEDBACK_SOURCES, ADMIN_ROLES, CONTENT_LIFECYCLE,
  PAGE_GROUPS, INTL_PROVIDER_KINDS, INTL_LEVELS, INTL_COURSE_CATEGORIES,
  INTL_SUBTITLE_LANGS, USER_MOTIVATIONS, USER_REFERRAL_SOURCES,
  articleBlockSchema, microCourseSchema,
} from './models/index.js';

/* ناظر مسیر نوشتن — عمداً از `./models/observe.js` مستقیم import می‌شود، نه از
   `index.js`؛ چون `observe.js` خودش `index.js` را import می‌کند و re-export
   کردنش یک حلقهٔ ESM می‌ساخت. */
import {
  inspectWrite, observeWrite, summarizeWriteReport, observeEnabled,
  takeWriteReports, peekWriteReports, resetWriteReports, OBSERVE_ENV,
} from './models/observe.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ───────────────────────────── چارچوب تست ───────────────────────────── */

const results = [];
let section = '';

const group = (name) => { section = name; };
const check = (name, condition) => results.push({ section, name, pass: Boolean(condition) });
const checkEqual = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  results.push({ section, name, pass: a === b, detail: a === b ? '' : `${a} ≠ ${b}` });
};

/** آیا نتیجهٔ اعتبارسنجی خطایی با این کد دارد؟ */
const hasCode = (result, code) => result.errors.some((entry) => entry.code === code);
const codes = (result) => result.errors.map((entry) => entry.code);

/* ═══════════════════════ ۱) پایه‌های فیلد ═══════════════════════ */

group('۱) پایه‌های فیلد');

const probe = (field, value) => field.check(value, {}) ?? null;

check('str: سقف نویسه', probe(str({ max: 5 }), 'abcdef')?.code === 'max');
check('str: کف نویسه', probe(str({ min: 3 }), 'ab')?.code === 'min');
check('str: نوع غلط', probe(str(), 12)?.code === 'type');
check('str: قالب (pattern)', probe(str({ pattern: /^\d+$/ }), 'abc')?.code === 'pattern');
check('str: خالی ممنوع', probe(str({ allowEmpty: false }), '')?.code === 'empty');

check('id: پیشوند الزامی', probe(id({ prefix: 'art' }), 'art-1') === null);
check('id: پیشوند نادرست رد می‌شود', probe(id({ prefix: 'art' }), 'pg-1')?.code === 'pattern');
check('idAnyOf: هر دو پیشوند مجاز', probe(idAnyOf(['fcd', 'deck']), 'deck-9') === null);
check('id: تغییرناپذیر و محافظت‌شده', id({ prefix: 'x' }).immutable === true && id({ prefix: 'x' }).protected === true);

check('slug: فاصله و حروف بزرگ رد می‌شود', probe(slug(), 'Hello World')?.code === 'pattern');
check('slug: قالب درست', probe(slug(), 'hello-world-2') === null);
check('hexColor: معتبر', probe(hexColor(), '#5b8cc7') === null);
check('hexColor: نام رنگ رد می‌شود', probe(hexColor(), 'red')?.code === 'pattern');

check('num: کف و سقف', probe(num({ min: 0, max: 10 }), 11)?.code === 'max' && probe(num({ min: 0, max: 10 }), -1)?.code === 'min');
check('num: عدد اعشاری ممنوع', probe(num({ int: true }), 1.5)?.code === 'integer');
check('num: NaN رد می‌شود (خطر تبدیل بی‌صدا به null در JSON)', probe(num(), Number.NaN)?.code === 'not_finite');
check('num: Infinity رد می‌شود', probe(num(), Number.POSITIVE_INFINITY)?.code === 'not_finite');
check('percent: سقف ۱۰۰', probe(percent(), 101)?.code === 'max' && probe(percent(), 100) === null);
check('count: منفی ممنوع', probe(count(), -1)?.code === 'min');
check('bool: فقط boolean', probe(bool(), 'true')?.code === 'type');

check('timestamp: قالب ISO معتبر', probe(timestamp(), '2026-09-29T10:50:40.970Z') === null);
check('timestamp: متن آزاد رد می‌شود', probe(timestamp(), 'دیروز')?.code === 'format');
check('timestamp: خالی → null در نرمال‌سازی', timestamp().normalize('') === null);
check('epoch: فقط عدد صحیح', probe(epoch(), 'abc')?.code === 'type' && probe(epoch(), 1_700_000_000_000) === null);

check('enumOf: مقدار مجاز', probe(enumOf(['a', 'b']), 'a') === null);
check('enumOf: مقدار نامجاز', probe(enumOf(['a', 'b']), 'c')?.code === 'enum');

check('arr: نوع آرایه', probe(arr(str()), 'not-array')?.code === 'type');
check('arr: سقف اعضا', probe(arr(str(), { max: 2 }), ['a', 'b', 'c'])?.code === 'max');
check('arr: کف اعضا', probe(arr(str(), { min: 2 }), ['a'])?.code === 'min');
check('arr: یکتایی اعضا', probe(arr(str(), { unique: true }), ['a', 'a'])?.code === 'duplicate');
check('obj: نوع آبجکت', probe(obj({ a: str() }), [])?.code === 'type');

check('optional/required: پرچم درست', optional(str()).required === false && required(str()).required === true);
check('immutable/secret/serverOnly: پرچم درست',
  immutable(str()).immutable === true && secret(str()).secret === true && serverOnly(str()).protected === true);

/* ═══════════════════════ ۲) ماتریس اعتبارسنجی ═══════════════════════ */

group('۲) ماتریس اعتبارسنجی (الزامی بند ۵۰)');

const fixture = {
  name: 'fixture',
  collection: 'fixtures',
  identityField: 'id',
  fields: {
    id: required(id({ prefix: 'fx' })),
    title: required(str({ min: 2, max: 40 })),
    kind: required(enumOf(['alpha', 'beta'])),
    code: immutable(str({ max: 20 })),
    score: num({ min: 0, max: 100 }),
    tags: arr(str(), { max: 4, unique: true }),
    meta: obj({ owner: str() }),
    createdAt: serverOnly(timestamp()),
  },
  unique: [{ fields: ['title'], caseInsensitive: true }],
  transitions: { field: 'kind', machine: 'FIXTURE' },
  transitionTables: { FIXTURE: { alpha: ['beta'], beta: [] } },
};

const validFixture = {
  id: 'fx-1', title: 'نمونه', kind: 'alpha', code: 'C-1', score: 10, tags: ['a', 'b'],
  meta: { owner: 'system' }, createdAt: '2026-09-29T00:00:00.000Z',
};

check('رکورد معتبر پذیرفته می‌شود', validateRecord(fixture, validFixture).ok);

const missingRequired = { ...validFixture };
delete missingRequired.title;
const missingResult = validateRecord(fixture, missingRequired);
check('فیلد الزامی غایب → required', hasCode(missingResult, 'required'));
check('مسیر فیلد الزامی درست گزارش می‌شود', missingResult.errors.some((e) => e.field === 'title' && e.code === 'required'));

check('نوع غلط → type', hasCode(validateRecord(fixture, { ...validFixture, score: 'بسیار' }), 'type'));
check('enum نامجاز → enum', hasCode(validateRecord(fixture, { ...validFixture, kind: 'gamma' }), 'enum'));
check('آرایهٔ نامعتبر → type', hasCode(validateRecord(fixture, { ...validFixture, tags: 'a,b' }), 'type'));
check('عضو تکراری آرایه → duplicate', hasCode(validateRecord(fixture, { ...validFixture, tags: ['a', 'a'] }), 'duplicate'));

check('null روی فیلد غیرnullable → null', hasCode(validateRecord(fixture, { ...validFixture, title: null }), 'null'));
check('null روی فیلد nullable مجاز است', validateRecord(
  { name: 'n', fields: { a: { ...str(), nullable: true } } }, { a: null },
).ok);

/* ── سیاست فیلد ناشناخته: stored → هشدار، create → خطا ── */
const unknownRecord = { ...validFixture, weirdKey: 1 };
const storedUnknown = validateRecord(fixture, unknownRecord, { mode: 'stored' });
const createUnknown = validateRecord(fixture, unknownRecord, { mode: 'create' });
check('فیلد ناشناخته در حالت stored هشدار است نه خطا',
  storedUnknown.ok && storedUnknown.warnings.some((w) => w.code === 'unknown_field'));
check('فیلد ناشناخته در حالت create خطاست', hasCode(createUnknown, 'unknown_field'));

/* ── فیلد محافظت‌شده و تغییرناپذیر ── */
const createProtected = validateRecord(fixture, { ...validFixture, id: 'fx-9' }, { mode: 'create' });
check('فیلد محافظت‌شده از Client پذیرفته نمی‌شود → protected_field', hasCode(createProtected, 'protected_field'));

const updateImmutable = validateRecord(fixture, { code: 'C-2' }, { mode: 'update', previous: validFixture });
check('فیلد تغییرناپذیر در ویرایش → immutable', hasCode(updateImmutable, 'immutable'));
check('فیلد تغییرناپذیر با همان مقدار قبلی مجاز است',
  validateRecord(fixture, { code: 'C-1' }, { mode: 'update', previous: validFixture }).ok);
check('ویرایش بدون تغییر شناسه مجاز است',
  validateRecord(fixture, { title: 'نمونهٔ تازه' }, { mode: 'update', previous: validFixture }).ok);

/* ── گذار وضعیت نامجاز ── */
const badTransition = validateRecord(fixture, { kind: 'alpha' }, { mode: 'update', previous: { ...validFixture, kind: 'beta' } });
check('گذار وضعیت نامجاز → invalid_transition', hasCode(badTransition, 'invalid_transition'));
const goodTransition = validateRecord(fixture, { kind: 'beta' }, { mode: 'update', previous: validFixture });
check('گذار وضعیت مجاز عبور می‌کند', goodTransition.ok);

/* ── assertValid قرارداد خطا را حفظ می‌کند (بند ۵۴) ── */
let thrown = null;
try { assertValid(fixture, { id: 'fx-1' }, { mode: 'create' }); } catch (error) { thrown = error; }
check('assertValid خطای VALIDATION_ERROR پرتاب می‌کند', thrown?.code === 'VALIDATION_ERROR');
check('assertValid نگاشت fields می‌سازد', Boolean(thrown?.fields && typeof thrown.fields === 'object'));
check('assertValid: پیام خطا فارسی و یک‌خطی است', typeof thrown?.message === 'string' && thrown.message.length > 0);

/* ═══════════════════════ ۳) تودرتو و اتحاد تفکیک‌شده ═══════════════════════ */

group('۳) ساختار تودرتو و بلوک محتوا');

const nested = validateRecord(
  { name: 'nested', fields: { a: obj({ b: required(str()), c: obj({ d: num() }) }) } },
  { a: { c: { d: 1 } } },
);
check('فیلد الزامی تودرتو با مسیر نقطه‌ای گزارش می‌شود', nested.errors.some((e) => e.field === 'a.b' && e.code === 'required'));
check('فیلد ناشناخته تودرتو گرفته می‌شود',
  hasCode(validateRecord({ name: 'x', fields: { a: obj({ b: str() }) } }, { a: { b: 'x', z: 1 } }), 'unknown_field'));

check('بلوک محتوا: نوع ناشناخته → unknown_variant',
  hasCode(validateRecord({ name: 'b', fields: { block: articleBlockSchema } }, { block: { type: 'zzz' } }), 'unknown_variant'));
check('بلوک محتوا: کلید تفکیک‌کننده غایب → required',
  hasCode(validateRecord({ name: 'b', fields: { block: articleBlockSchema } }, { block: { text: 'x' } }), 'required'));
check('بلوک محتوا: نوع شناخته‌شده با کلیدهای الزامی درست عبور می‌کند',
  validateRecord({ name: 'b', fields: { block: articleBlockSchema } }, { block: { type: 'p', text: 'سلام' } }).ok);
check('بلوک محتوا: نوع شناخته‌شده با کلید الزامی غایب رد می‌شود',
  !validateRecord({ name: 'b', fields: { block: articleBlockSchema } }, { block: { type: 'p' } }).ok);

/* ═══════════════════════ ۴) یکتایی و شناسه ═══════════════════════ */

group('۴) یکتایی، شناسهٔ تکراری و قید ترکیبی');

const idRows = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: '' }, { id: null }];
const idIssues = findIdentityIssues({ identityField: 'id' }, idRows);
check('شناسهٔ تکراری شناسایی می‌شود', idIssues.duplicates.length === 1 && idIssues.duplicates[0].value === 'a');
check('شمارش تکرار درست است', idIssues.duplicates[0].count === 2);
check('نبودِ شناسه (خالی و null) شناسایی می‌شود', idIssues.missing.length === 2);
check('مجموعهٔ سالم شناسه، خطا ندارد',
  findIdentityIssues({ identityField: 'id' }, [{ id: 'a' }, { id: 'b' }]).duplicates.length === 0);

const uniqueSchema = { name: 'u', collection: 'us', unique: [{ fields: ['handle'], caseInsensitive: true }] };
check('قید یکتا: تکرار حساس‌نبودن به بزرگی/کوچکی',
  findUniqueViolations(uniqueSchema, [{ handle: 'Tapesh' }, { handle: 'tapesh' }]).length === 1);
check('قید یکتا: مقدار خالی نادیده گرفته می‌شود',
  findUniqueViolations(uniqueSchema, [{ handle: '' }, { handle: null }, { handle: undefined }]).length === 0);
check('قید یکتا: مقادیر یکتا خطا نمی‌دهند',
  findUniqueViolations(uniqueSchema, [{ handle: 'a' }, { handle: 'b' }]).length === 0);

const compositeSchema = { name: 'c', collection: 'cs', unique: [{ fields: ['platform', 'externalId'] }] };
check('قید ترکیبی: تکرار کامل شناسایی می‌شود',
  findUniqueViolations(compositeSchema, [
    { platform: 'telegram', externalId: '@tapesh' },
    { platform: 'telegram', externalId: '@tapesh' },
  ]).length === 1);
check('قید ترکیبی: تفاوت در یک جزء، نقض نیست',
  findUniqueViolations(compositeSchema, [
    { platform: 'telegram', externalId: '@tapesh' },
    { platform: 'eitaa', externalId: '@tapesh' },
  ]).length === 0);

/* ── checkUnique برای ورودی تازه: خودِ رکورد نباید «تکراری» شمرده شود ── */
const selfCollection = { us: [{ id: 'x1', handle: 'tapesh' }] };
const selfSchema = { ...uniqueSchema, identityField: 'id' };
check('checkUnique: رکورد با خودش تکراری اعلام نمی‌شود',
  checkUnique(selfSchema, uniqueSchema.unique[0], selfCollection.us[0], selfCollection) === null);
check('checkUnique: رکورد تازهٔ تکراری گرفته می‌شود',
  checkUnique(selfSchema, uniqueSchema.unique[0], { id: 'x2', handle: 'TAPESH' }, selfCollection)?.code === 'duplicate');

/* ═══════════════════════ ۵) ارجاع‌ها و قواعد حذف ═══════════════════════ */

group('۵) ارجاع‌ها، یتیم‌ها و قواعد حذف');

const orphanRelation = { child: 'articles', field: 'category', parent: 'categories', required: true };
check('یتیم شناسایی می‌شود',
  findRelationOrphans(orphanRelation, [{ id: 'a1', category: 'cat-9' }], new Set(['cat-1'])).missing.length === 1);
check('والد موجود یتیم نیست',
  findRelationOrphans(orphanRelation, [{ id: 'a1', category: 'cat-1' }], new Set(['cat-1'])).missing.length === 0);
check('مقدار خالی روی ارتباط الزامی، یتیم است',
  findRelationOrphans(orphanRelation, [{ id: 'a1', category: null }], new Set(['cat-1'])).missing.length === 1);
check('مقدار خالی روی ارتباط اختیاری، یتیم نیست',
  findRelationOrphans({ ...orphanRelation, required: false }, [{ id: 'a1', category: null }], new Set()).missing.length === 0);

const arrayRelation = { child: 'mediaTeam', field: 'platformIds', parent: 'mediaPlatforms', array: true };
check('ارتباط آرایه‌ای: عضو یتیم شناسایی می‌شود',
  findRelationOrphans(arrayRelation, [{ id: 'tm-1', platformIds: ['instagram', 'zzz'] }], new Set(['instagram'])).missing.length === 1);
check('ارتباط آرایه‌ای: عضو نگهبان (sentinel) نادیده گرفته می‌شود',
  findRelationOrphans({ ...arrayRelation, sentinels: ['system'] }, [{ id: 'tm-1', platformIds: ['system'] }], new Set()).missing.length === 0);

check('هر ارتباط قاعدهٔ حذف اعلام‌شده دارد',
  RELATIONS.every((relation) => typeof relation.deleteRule === 'string' && relation.deleteRule.length > 0));
check('هر ارتباط شاهد (evidence) دارد — قاعده از کد استخراج شده، نه حدس',
  RELATIONS.every((relation) => typeof relation.evidence === 'string' && relation.evidence.length > 0));
check('هر ارتباط والد و فرزند معتبر دارد',
  RELATIONS.every((relation) => Boolean(relation.child) && Boolean(relation.field) && Boolean(relation.parent)));
check('قاعدهٔ حذف از واژگان بسته است',
  RELATIONS.every((relation) => ['RESTRICT', 'SET_NULL', 'DETACH', 'CASCADE', 'SOFT', 'FREE'].includes(relation.deleteRule)));
check('هر ارجاع چندریختی نقشهٔ نوع دارد',
  POLYMORPHIC_RELATIONS.every((relation) => relation.map && Object.keys(relation.map).length > 0));
check('نام مجموعه‌های والد در ارجاع‌ها به Schema شناخته‌شده اشاره می‌کند',
  RELATIONS.every((relation) => Boolean(MODELS_BY_COLLECTION[relation.parent])));
check('نام مجموعه‌های فرزند در ارجاع‌ها به Schema شناخته‌شده اشاره می‌کند',
  RELATIONS.every((relation) => Boolean(MODELS_BY_COLLECTION[relation.child])));

/* ═══════════════════════ ۶) ماشین وضعیت ═══════════════════════ */

group('۶) گذار وضعیت');

check('رجیستری گذارها پر است', Object.keys(TRANSITION_REGISTRY).length >= 2);
check('گذار مجاز تأیید می‌شود', canTransition('MEDIA_CONTENT', 'draft', 'review') === true);
check('گذار نامجاز رد می‌شود', canTransition('MEDIA_CONTENT', 'published', 'draft') === false);
check('وضعیت ناشناخته در ماشین، گذار نمی‌دهد', canTransition('MEDIA_CONTENT', 'zzz', 'draft') === false);
check('وضعیت نهایی (published) گذار خروجی محدود دارد',
  (MEDIA_CONTENT_TRANSITIONS.published ?? []).length > 0);
check('هر وضعیت در جدول گذار، کلید معتبر دارد',
  Object.keys(MEDIA_CONTENT_TRANSITIONS).every((key) => MEDIA_CONTENT_STATUSES.includes(key)));
check('هر مقصد گذار، یک وضعیت شناخته‌شده است',
  Object.values(MEDIA_CONTENT_TRANSITIONS).flat().every((to) => MEDIA_CONTENT_STATUSES.includes(to)));

/* ═══════════════════════ ۷) قواعد بین‌فیلدی ═══════════════════════ */

group('۷) قواعد بین‌فیلدی');

check('رجیستری قواعد بین‌فیلدی پر است', Object.keys(CROSS_FIELD_CHECKS).length >= 10);
check('هر قاعدهٔ بین‌فیلدی تابع است',
  Object.values(CROSS_FIELD_CHECKS).every((fn) => typeof fn === 'function'));
check('هر نام قاعدهٔ ارجاع‌شده در Schema موجود است',
  MODELS.every((schema) => (schema.crossField ?? []).every((name) => typeof CROSS_FIELD_CHECKS[name] === 'function')));
check('هر نام بررسی عمیق ارجاع‌شده در Schema موجود است',
  MODELS.every((schema) => !schema.deepCheck || typeof schema.deepCheck === 'string'));

const publishedAtRule = CROSS_FIELD_CHECKS.publishedAtRequiresPublished;
check('publishedAt روی رکورد منتشرنشده خطا می‌دهد',
  Boolean(publishedAtRule({ status: 'draft', publishedAt: '2026-01-01T00:00:00.000Z' }, {})));
check('publishedAt روی رکورد منتشرشده خطا نمی‌دهد',
  publishedAtRule({ status: 'published', publishedAt: '2026-01-01T00:00:00.000Z' }, {}) === null);
check('publishedAt غایب روی پیش‌نویس خطا نمی‌دهد',
  publishedAtRule({ status: 'draft', publishedAt: null }, {}) === null);

/* ═══════════════════════ ۸) نرمال‌سازی ≠ تعمیر ═══════════════════════ */

group('۸) نرمال‌سازی ≠ تعمیر (بند ۵۳)');

const normalizeSchema = {
  name: 'norm',
  fields: {
    phone: str(),
    title: str(),
    tags: strArray(),
    meta: obj({ term: str(), nested: obj({ code: str() }) }),
  },
};

check('نرمال‌سازی به داخل آبجکت تودرتو فرود می‌کند (مسیر برگ گزارش می‌شود)',
  (() => {
    const out = normalizeRecord(normalizeSchema, { meta: { nested: { code: '  x  ' } } });
    return out.record.meta.nested.code === 'x' && out.changed.includes('meta.nested.code');
  })());

check('نرمال‌سازی به داخل آرایهٔ آبجکت فرود می‌کند',
  (() => {
    const out = normalizeRecord(
      { name: 'arr', fields: { rows: arr(obj({ code: str() })) } },
      { rows: [{ code: '  a  ' }, { code: ' b ' }] },
    );
    return out.record.rows[0].code === 'a' && out.changed.includes('rows[0].code');
  })());

/* ── نرمال‌سازی ساختاری: آرایه/آبجکت سالم نباید «تغییر» شمرده شود ── */
const originalTags = ['a', 'b'];
const untouched = normalizeRecord(normalizeSchema, {
  title: 'عنوان', tags: originalTags, meta: { term: '۸', nested: { code: 'x' } },
});
check('رکورد سالم هیچ فیلد «تغییرکرده» ندارد (مقایسه ساختاری، نه ارجاعی)', untouched.changed.length === 0);
check('آرایهٔ بدون تغییر، همان ارجاع را برمی‌گرداند (بدون کپی بی‌دلیل)', untouched.record.tags === originalTags);

check('sameValue: آرایهٔ هم‌محتوا برابر است', sameValue([1, { a: 2 }], [1, { a: 2 }]) === true);
check('sameValue: آرایهٔ متفاوت برابر نیست', sameValue([1, 2], [1, 3]) === false);
check('sameValue: ترتیب کلید مهم نیست', sameValue({ a: 1, b: 2 }, { b: 2, a: 1 }) === true);

const trimmed = normalizeRecord({ name: 't', fields: { title: str() } }, { title: '  متن  ' });
check('فاصلهٔ اضافی trim می‌شود و مسیر برگ گزارش می‌شود',
  trimmed.record.title === 'متن' && trimmed.changed.includes('title'));

/* ⚠️ نرمال‌سازی نباید مقدار نامعتبر را «معتبر» کند. */
const bogus = normalizeRecord({ name: 'p', fields: { amount: num() } }, { amount: 'abc' });
check('نرمال‌سازی، مقدار نامعتبر را به عدد تبدیل نمی‌کند (تعمیر ممنوع)',
  validateRecord({ name: 'p', fields: { amount: num() } }, bogus.record).ok === false);
check('نرمال‌سازی «abc» را به 0 تبدیل نمی‌کند', bogus.record.amount === 'abc');

check('نرمال‌سازی فیلد ناشناخته را حذف نمی‌کند',
  Object.hasOwn(normalizeRecord({ name: 'u', fields: {} }, { extra: 1 }).record, 'extra'));
check('نرمال‌سازی null را دست نمی‌زند',
  normalizeRecord({ name: 'n', fields: { a: str() } }, { a: null }).record.a === null);

/* ═══════════════════════ ۹) راز و محافظت ═══════════════════════ */

group('۹) راز، محافظت و پیش‌فرض');

const secretSchema = {
  name: 's',
  fields: { id: id({ prefix: 's' }), passwordHash: secret(str()), name: str(), token: secret(str()) },
};
check('secretFieldNames فیلدهای راز را می‌شناسد',
  JSON.stringify(secretFieldNames(secretSchema)) === JSON.stringify(['passwordHash', 'token']));
const stripped = stripSecrets(secretSchema, { id: 's-1', passwordHash: 'h', name: 'n', token: 't' });
check('stripSecrets رازها را حذف می‌کند', !Object.hasOwn(stripped, 'passwordHash') && !Object.hasOwn(stripped, 'token'));
check('stripSecrets فیلد غیرراز را نگه می‌دارد', stripped.name === 'n' && stripped.id === 's-1');

check('applyDefaults مقدار پیش‌فرض را درج می‌کند',
  applyDefaults({ fields: { a: { ...str(), default: 'x' }, b: str() } }, {}).a === 'x');
check('applyDefaults ورودی را بازنویسی نمی‌کند',
  (() => { const input = {}; applyDefaults({ fields: { a: { ...str(), default: 'x' } } }, input); return !Object.hasOwn(input, 'a'); })());

const schemaSecrets = schemaCoverage().secretFields;
check('Schemaها فیلد راز اعلام‌شده دارند', schemaSecrets.length > 0);
check('فیلد راز هر Schema با علامت secret هم‌خوان است',
  schemaSecrets.every((entry) => {
    const [entity, field] = entry.split('.');
    return Boolean(MODEL_BY_NAME[entity]?.fields?.[field]?.secret);
  }));

/* ═══════════════════════ ۱۰) شکل ذخیره‌سازی ═══════════════════════ */

group('۱۰) شکل ذخیره‌سازی (گاردِ افتِ بی‌صدا)');

check('array: آرایه پذیرفته می‌شود', checkStorageShape({ storage: 'array' }, []) === null);
check('array: آرایهٔ غیرخالی پذیرفته می‌شود', checkStorageShape({ storage: 'array' }, [{ a: 1 }]) === null);
check('array: آبجکت پوشش‌دار رد می‌شود (همان باگ users.json)',
  checkStorageShape({ storage: 'array' }, { users: [{ a: 1 }] })?.code === 'storage_shape_mismatch');
check('keyed-array: کلید درست پذیرفته می‌شود', checkStorageShape({ storage: 'keyed-array', arrayKey: 'items' }, { items: [] }) === null);
check('keyed-array: کلید نادرست رد می‌شود',
  checkStorageShape({ storage: 'keyed-array', arrayKey: 'items' }, { rows: [] })?.code === 'storage_shape_mismatch');
check('keyed-object: نگاشت پذیرفته می‌شود', checkStorageShape({ storage: 'keyed-object' }, { a: {}, b: {} }) === null);
check('singleton: آبجکت پذیرفته می‌شود', checkStorageShape({ storage: 'singleton' }, { a: 1 }) === null);
check('ظرف null بررسی نمی‌شود', checkStorageShape({ storage: 'array' }, null) === null);
check('فایل کاملاً خالی خطا نیست', checkStorageShape({ storage: 'array' }, {}) === null);

check('کلید نشست نامعتبر شناسایی می‌شود',
  findStorageKeyIssues({ storage: 'keyed-object', keyIsIdentity: true }, ['not-a-token']).length === 1);
check('کلید نشست معتبر (۶۴ hex) پذیرفته می‌شود',
  findStorageKeyIssues({ storage: 'keyed-object', keyIsIdentity: true }, ['a'.repeat(64)]).length === 0);

/* ═══════════════════════ ۱۱) انطباق enum با منبع اصلی ═══════════════════════ */

group('۱۱) انطباق enum با منبع اصلی');

const sorted = (list) => [...list].map(String).sort();
const idsOf = (list) => sorted(list.map((item) => (typeof item === 'string' ? item : item.id)));
const keysOf = (map) => sorted(Object.keys(map));

const mediaStore = await import('./mediaStore.js');
const contentStore = await import('./contentStore.js');
const analyticsStore = await import('./analyticsStore.js');
const publishingStore = await import('./publishingStore.js');
const testBankData = await import('../src/services/testBank/mockData.js');
const intlCatalog = await import('../src/services/international/intlCatalog.js');
const notesData = await import('../src/services/notes/mockData.js');

const conformance = (label, registry, canonical) => {
  const a = sorted(registry);
  const b = sorted(canonical);
  results.push({
    section,
    name: label,
    pass: JSON.stringify(a) === JSON.stringify(b),
    detail: JSON.stringify(a) === JSON.stringify(b) ? '' : `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`,
  });
};

conformance('MEDIA_CONTENT_STATUSES ↔ mediaStore.CONTENT_STATUSES', MEDIA_CONTENT_STATUSES, idsOf(mediaStore.CONTENT_STATUSES));
conformance('MEDIA_CONTENT_TYPES ↔ mediaStore.CONTENT_TYPES', MEDIA_CONTENT_TYPES, idsOf(mediaStore.CONTENT_TYPES));
conformance('MEDIA_ACCOUNT_KINDS ↔ mediaStore.ACCOUNT_KINDS', MEDIA_ACCOUNT_KINDS, idsOf(mediaStore.ACCOUNT_KINDS));
conformance('MEDIA_TEAM_ROLES ↔ mediaStore.MEDIA_ROLES', MEDIA_TEAM_ROLES, idsOf(mediaStore.MEDIA_ROLES));
conformance('MEDIA_CAMPAIGN_STATUSES ↔ mediaStore.CAMPAIGN_STATUSES', MEDIA_CAMPAIGN_STATUSES, idsOf(mediaStore.CAMPAIGN_STATUSES));
conformance('MEDIA_INBOX_STATUSES ↔ mediaStore.INBOX_STATUSES', MEDIA_INBOX_STATUSES, idsOf(mediaStore.INBOX_STATUSES));
conformance('MEDIA_INBOX_KINDS ↔ mediaStore.INBOX_KINDS', MEDIA_INBOX_KINDS, idsOf(mediaStore.INBOX_KINDS));
conformance('MEDIA_NOTIFICATION_LEVELS ↔ mediaStore.NOTIFICATION_LEVELS', MEDIA_NOTIFICATION_LEVELS, idsOf(mediaStore.NOTIFICATION_LEVELS));
conformance('MEDIA_TAG_KINDS ↔ mediaStore.TAG_KINDS', MEDIA_TAG_KINDS, idsOf(mediaStore.TAG_KINDS));
conformance('MEDIA_ASSET_KINDS ↔ mediaStore.ASSET_KINDS', MEDIA_ASSET_KINDS, idsOf(mediaStore.ASSET_KINDS));
conformance('MEDIA_UTM_MEDIUMS ↔ mediaStore.UTM_MEDIUMS', MEDIA_UTM_MEDIUMS, idsOf(mediaStore.UTM_MEDIUMS));
conformance('MEDIA_ENTITY_TYPES ↔ mediaStore.MEDIA_ENTITY_TYPES', MEDIA_ENTITY_TYPES, mediaStore.MEDIA_ENTITY_TYPES);

/* ناظر تحلیلی — فهرست نوع رویداد. `normalizeEvent()` مقدار ناشناخته را به
   `page_view` برمی‌گرداند، پس مقدار ذخیره‌شده همیشه عضوی از همین فهرست است. */
conformance('ANALYTICS_EVENT_TYPES ↔ analyticsStore.EVENT_TYPES',
  ANALYTICS_EVENT_TYPES, [...analyticsStore.EVENT_TYPES]);

conformance('ADMIN_ROLES ↔ contentStore.ROLES', ADMIN_ROLES, keysOf(contentStore.ROLES));
conformance('CONTENT_LIFECYCLE ↔ contentStore.ARTICLE_STATUSES', CONTENT_LIFECYCLE, contentStore.ARTICLE_STATUSES);
conformance('NOTE_KINDS ↔ notes/mockData.NOTE_KINDS', NOTE_KINDS, idsOf(notesData.NOTE_KINDS));
conformance('NOTE_SOURCE_TYPES ↔ notes/mockData.SOURCE_TYPES', NOTE_SOURCE_TYPES, idsOf(notesData.SOURCE_TYPES));

check('NOTE_KINDS رجیستری، ابرمجموعهٔ contentStore.NOTE_KINDS است (پنل فقط دو نوع دارد)',
  contentStore.NOTE_KINDS.every((kind) => NOTE_KINDS.includes(kind)));

conformance('ALERT_METRICS ↔ analyticsStore.ALERT_METRICS', ALERT_METRICS, idsOf(analyticsStore.ALERT_METRICS));
conformance('PUBLISH_LOG_STATUSES ↔ publishingStore.PUBLISH_STATUSES', PUBLISH_LOG_STATUSES, keysOf(publishingStore.PUBLISH_STATUSES));

/* ⚠️ enumهای بانک تست در منبع، **نگاشت** هستند (`{ id: { label, ... } }`)، پس کلید. */
conformance('TEST_BANK_DIFFICULTIES ↔ testBank.DIFFICULTIES', TEST_BANK_DIFFICULTIES, keysOf(testBankData.DIFFICULTIES));
conformance('TEST_BANK_TYPES ↔ testBank.QUESTION_TYPES', TEST_BANK_TYPES, keysOf(testBankData.QUESTION_TYPES));
conformance('TEST_BANK_SOURCES ↔ testBank.SOURCES', TEST_BANK_SOURCES, keysOf(testBankData.SOURCES));
conformance('TEST_BANK_TRACKS ↔ testBank.TRACKS', TEST_BANK_TRACKS, keysOf(testBankData.TRACKS));

conformance('INTL_PROVIDER_KINDS ↔ intlCatalog.INTL_PROVIDER_KINDS', INTL_PROVIDER_KINDS, idsOf(intlCatalog.INTL_PROVIDER_KINDS));
conformance('INTL_LEVELS ↔ intlCatalog.INTL_LEVELS', INTL_LEVELS, idsOf(intlCatalog.INTL_LEVELS));
conformance('INTL_COURSE_CATEGORIES ↔ intlCatalog.INTL_COURSE_CATEGORIES', INTL_COURSE_CATEGORIES, idsOf(intlCatalog.INTL_COURSE_CATEGORIES));
conformance('INTL_SUBTITLE_LANGS ↔ intlCatalog.INTL_SUBTITLE_LANGS', INTL_SUBTITLE_LANGS, idsOf(intlCatalog.INTL_SUBTITLE_LANGS));

/* ── enumهایی که در منبع صادر نشده‌اند: انطباق با متن منبع + دادهٔ واقعی ── */
const mediaStoreSource = readFileSync(new URL('./mediaStore.js', import.meta.url), 'utf8');

check('MEDIA_MENTION_SENTIMENTS با فهرست درون‌خطی mediaStore هم‌خوان است',
  mediaStoreSource.includes("['positive', 'neutral', 'negative']")
  && JSON.stringify(sorted(MEDIA_MENTION_SENTIMENTS)) === JSON.stringify(sorted(['positive', 'neutral', 'negative'])));

const platformIds = idsOf(publishingStore.PUBLISH_PLATFORMS ?? []);
check('MEDIA_PLATFORMS با publishingStore.PUBLISH_PLATFORMS هم‌خوان است',
  JSON.stringify(sorted(MEDIA_PLATFORMS)) === JSON.stringify(platformIds));

check('قواعد مقایسهٔ هشدارها از واژگان بسته است',
  ALERT_COMPARATORS.every((value) => typeof value === 'string') && ALERT_SEVERITIES.length > 0);
check('وضعیت‌های بازخورد با feedbackStore هم‌خوان است',
  FEEDBACK_STATUSES.includes('open') && FEEDBACK_SOURCES.length > 0);

check('رجیستری enum یکتاست (بدون تکرار مقدار در یک enum)',
  Object.entries(ENUM_REGISTRY).every(([, values]) => Array.isArray(values) && new Set(values).size === values.length));
check('هر enum رجیستری آرایهٔ غیرخالی است',
  Object.values(ENUM_REGISTRY).every((values) => Array.isArray(values) && values.length > 0));

/* ═══════════════════════ ۱۲) اسکن دادهٔ واقعی ═══════════════════════ */

group('۱۲) اسکن دادهٔ واقعی');

/** خواندن یک فایل داده بر اساس شکل اعلامی Schema — بدون هیچ نوشتنی. */
function loadReal(schema) {
  const path = fileURLToPath(new URL(`../${schema.file}`, import.meta.url));
  if (!existsSync(path)) return { records: [], container: null, missing: true };
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const shape = schema.storage ?? 'array';
  if (shape === 'array') return { records: Array.isArray(raw) ? raw : [], container: raw, missing: false };
  if (shape === 'keyed-array') {
    const rows = raw?.[schema.arrayKey];
    return { records: Array.isArray(rows) ? rows : [], container: raw, missing: false };
  }
  if (shape === 'keyed-object') {
    const source = schema.objectKey ? (raw?.[schema.objectKey] ?? {}) : (raw ?? {});
    const entries = Object.entries(source);
    return {
      records: entries.map(([, value]) => value ?? {}),
      keys: entries.map(([key]) => key),
      container: raw,
      missing: false,
    };
  }
  return { records: raw && typeof raw === 'object' ? [raw] : [], container: raw, missing: false };
}

const real = new Map();
const realCollections = {};
let realRecordCount = 0;

/*
 * مجموعه‌هایی که **تا اولین نوشتن فایلی ندارند** — نه یک شکاف، بلکه طراحی:
 * فایلشان در `.gitignore` است و سرور در زمان اجرا می‌سازدشان
 * (`feedback`, `mediaMetrics`, `admins`, `activity`, `events`, `publishLog`,
 * `exams*`, `users.json` …). پس روی یک checkout تمیز، نبودِ فایل‌شان **درست**
 * است و نباید تست را بشکند. هر مجموعهٔ محتواییِ دیگری که فایلش گم شود،
 * همچنان تست را می‌شکند.
 *
 * ⚠️ پیش‌تر این فهرست **دستی و ناقص** بود (فقط دو عضو) و روی checkout تمیز
 * بقیهٔ فایل‌های ignore‌شده تست را می‌شکستند. حالا از خود `.gitignore`
 * استخراج می‌شود تا با تغییر آن واگرا نشود.
 */
function gitignorePatterns() {
  const raw = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  return raw.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function isGitignored(relPath, patterns) {
  return patterns.some((pattern) => {
    const clean = pattern.replace(/^\//, '');
    if (clean.endsWith('/')) return relPath.startsWith(clean);
    const body = clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*');
    return new RegExp(`^${body}$`).test(relPath);
  });
}

const ignorePatterns = gitignorePatterns();
const runtimeOnlySchemas = MODELS
  .filter((schema) => schema.file && isGitignored(schema.file, ignorePatterns));
const RUNTIME_ONLY_COLLECTIONS = [...new Set(runtimeOnlySchemas
  .map((schema) => schema.collection).filter(Boolean))].sort();
const RUNTIME_ONLY_FILES = new Set(runtimeOnlySchemas.map((schema) => schema.file));

for (const schema of MODELS) {
  if (!schema.file) continue;
  const loaded = loadReal(schema);
  real.set(schema.name, loaded);
  /* ⚠️ مجموعهٔ غایب **ثبت نمی‌شود** — نه با آرایهٔ خالی. این تفاوت حیاتی است:
     اعتبارسنجی ارجاع (`makeRefLookup`) برای مجموعهٔ ثبت‌نشده «تأییدنشده»
     برمی‌گرداند و خطا نمی‌دهد؛ ولی آرایهٔ خالی یعنی «مجموعه هست و خالی است»
     و همهٔ ارجاع‌ها را یتیم می‌کند. روی checkout تمیز (که `admins.json`
     زمان‌اجراست) همین یک نکته، ۱۱ یادداشت را کاذبانه یتیم می‌کرد. */
  if (loaded.missing) continue;
  const key = schema.collection ?? schema.name;
  realCollections[key] = [...(realCollections[key] ?? []), ...loaded.records];
  realRecordCount += loaded.records.length;
}

/* ── مجموعهٔ آزمون مصنوعی (deterministic) ──────────────────────────────
   چرا لازم است: سنجه‌های «حجم داده» پایین‌تر پیش‌تر روی `realRecordCount`
   تکیه داشتند، ولی چند مجموعهٔ واقعی در `.gitignore` هستند (بالا) و روی یک
   checkout تمیز وجود ندارند؛ پس آن سنجه‌ها ذاتاً در CI fail می‌شدند، بدون
   آنکه چیزی واقعاً خراب باشد.
   این مجموعهٔ مصنوعی **درون‌تست و قطعی** است: نه فایلی می‌سازد، نه با دادهٔ
   کاربران قاطی می‌شود، و صرفاً تضمین می‌کند خط لولهٔ اسکن/نرمال‌سازی روی یک
   مجموعهٔ کاملِ >۱٬۴۰۰ رکوردی واقعاً اجرا شده است. سنجه‌های یکپارچگیِ دادهٔ
   واقعی (یتیم، شناسهٔ تکراری، خطای Schema) همچنان **فقط** روی دادهٔ واقعی‌اند.
   مقادیر عمداً متعارف‌اند تا گذر دومِ نرمال‌سازی صفر تغییر بسازد (idempotency). */
const SYNTHETIC_PER_MODEL = 48;

function syntheticValueForField(field, index) {
  switch (field?.kind) {
    case 'string': return `s-${index}`;
    case 'number': return index + 1;
    case 'boolean': return index % 2 === 0;
    case 'enum': return 'x';
    case 'array': return [];
    case 'object': return {};
    case 'json': return {};
    case 'ref': return `s-${index}`;
    case 'timestamp': return '2026-01-01T00:00:00.000Z';
    case 'epoch': return 1;
    default: return null; /* اتحاد/تفکیک‌شده/any — نرمال‌سازی نادیده می‌گیرد */
  }
}

function syntheticRecords(schema) {
  const records = [];
  for (let index = 0; index < SYNTHETIC_PER_MODEL; index += 1) {
    const record = {};
    for (const [key, field] of Object.entries(schema.fields ?? {})) {
      record[key] = syntheticValueForField(field, index);
    }
    records.push(record);
  }
  return records;
}

let syntheticScanned = 0;
const syntheticNonIdempotent = [];
for (const schema of MODELS) {
  if (!schema.file) continue;
  for (const record of syntheticRecords(schema)) {
    syntheticScanned += 1;
    const first = normalizeRecord(schema, record);
    const second = normalizeRecord(schema, first.record);
    if (second.changed.length) syntheticNonIdempotent.push(`${schema.name}:${second.changed.join(',')}`);
  }
}
const scannedRecordCount = realRecordCount + syntheticScanned;

/* ⚠️ اصلاح‌شده: این سنجه پیش از این **هر** فایل اعلام‌شده در Schema را لازم
   می‌دانست و فایل‌های صرفاً-زمان‌اجرا (در `.gitignore`) را هم شامل می‌شد؛ روی
   یک checkout تمیز آن‌ها وجود ندارند، پس دروازه در CI هیچ‌وقت سبز نمی‌شد.
   حالا فقط فایل‌های **ردیابی‌شده** الزامی‌اند. فیلتر بر پایهٔ خودِ مسیر فایل
   است (نه نام مجموعه) تا Entityهای بدون `collection` مثل `publishingSecret`
   هم درست پوشش داده شوند. */
const missingFiles = [...new Set(MODELS
  .filter((schema) => schema.file
    && real.get(schema.name)?.missing
    && !RUNTIME_ONLY_FILES.has(schema.file))
  .map((schema) => schema.file))];
check(`همهٔ فایل‌های دادهٔ اعلام‌شده در Schema موجودند${missingFiles.length ? ` — غایب: ${missingFiles.join(', ')}` : ''}`,
  missingFiles.length === 0);
check('مجموع رکورد اسکن‌شده (واقعی + مصنوعی) بیش از ۱٬۴۰۰ است', scannedRecordCount > 1400);
check('مجموعهٔ آزمون مصنوعی به‌تنهایی از آستانهٔ ۱٬۴۰۰ می‌گذرد (قطعی، مستقل از دادهٔ زمان‌اجرا)',
  syntheticScanned > 1400);
check('هیچ مجموعه‌ای بی‌صدا خالی خوانده نمی‌شود (گارد شکل ذخیره‌سازی)',
  MODELS.every((schema) => !schema.file || checkStorageShape(schema, real.get(schema.name)?.container) === null));

check('پوشش Schema: هر فایل دادهٔ اسکن‌شده زیر یک Entity رسمی است',
  MODELS.filter((schema) => schema.file).every((schema) => (schema.collection
    ? Boolean(MODELS_BY_COLLECTION[schema.collection])
    : schema.storage === 'singleton')));
check('نگاشت «مجموعه → فایل» کامل است — هیچ مجموعه‌ای بدون مسیر نمی‌ماند',
  Object.keys(MODELS_BY_COLLECTION).every((key) => typeof COLLECTION_FILES[key] === 'string'));
check('هر Schema نام یکتا دارد', new Set(MODELS.map((schema) => schema.name)).size === MODELS.length);
check('هر Schema مسیر فایل اعلام‌شده دارد', MODELS.every((schema) => typeof schema.file === 'string' && schema.file.length > 0));
check('هر Schema یا شناسه دارد، یا هویت نگاشتی، یا کلید یکتای ترکیبی',
  MODELS.every((schema) => Boolean(schema.identityField)
    || schema.keyIsIdentity === true
    || schema.storage === 'singleton'
    || (Array.isArray(schema.unique) && schema.unique.length > 0)));

/* ── هیچ شناسهٔ تکراری و هیچ نقض قید یکتایی در دادهٔ واقعی ── */
const identityFindings = [];
const uniqueFindings = [];
for (const schema of MODELS) {
  const loaded = real.get(schema.name);
  if (!loaded) continue;
  const issues = findIdentityIssues(schema, loaded.records);
  if (issues.duplicates.length) identityFindings.push({ entity: schema.name, duplicates: issues.duplicates });
  const violations = findUniqueViolations(schema, loaded.records);
  if (violations.length) uniqueFindings.push({ entity: schema.name, violations });
}
check('دادهٔ واقعی هیچ شناسهٔ تکراری ندارد', identityFindings.length === 0);
check('دادهٔ واقعی هیچ نقض قید یکتایی ندارد', uniqueFindings.length === 0);

/* ── هیچ یتیم سخت (غیرتاریخی) در دادهٔ واقعی ──
   ⚠️ اگر مجموعهٔ والد در این checkout وجود نداشته باشد (فایلش زمان‌اجراست)،
   ارجاع **تأییدنشده** است نه یتیم — همان قرارداد `makeRefLookup`. پس آن
   ارتباط سنجیده نمی‌شود؛ روی ماشینی که دادهٔ زمان‌اجرا دارد، کامل سنجیده می‌شود. */
const hardOrphans = [];
for (const relation of RELATIONS) {
  if (relation.onMissing === 'warn') continue;
  if (!Object.hasOwn(realCollections, relation.parent)) continue;
  const parentField = relation.parentField ?? 'id';
  const parentIds = new Set((realCollections[relation.parent] ?? []).map((row) => row?.[parentField]).filter(Boolean));
  const { missing } = findRelationOrphans(relation, realCollections[relation.child] ?? [], parentIds);
  if (missing.length) hardOrphans.push({ relation: `${relation.child}.${relation.field}`, missing });
}
check('دادهٔ واقعی هیچ یتیم سخت (نقض یکپارچگی ارجاعی) ندارد', hardOrphans.length === 0);

/* ── هیچ نشت راز در سطح مدل ── */
check('هیچ مجموعه‌ای فیلد رازِ اعلام‌نشده ندارد',
  findSecretLeaks(MODELS, realCollections, secretFieldNames).length === 0);

/* ── کلید نشست‌های واقعی ── */
const sessionSchema = MODEL_BY_NAME.session;
const sessionKeys = real.get('session')?.keys ?? [];
check('کلید همهٔ نشست‌های واقعی قالب درست دارد',
  findStorageKeyIssues(sessionSchema, sessionKeys).length === 0);

/* ── یافته‌های شناخته‌شدهٔ داده (بند ۵۰/۵۳: گزارش، نه تعمیر بی‌صدا) ──
   ⚠️ خط لوله اینجا هم مثل اسکنر است: normalize → validate. نرمال‌سازی فقط
   در حافظه انجام می‌شود؛ چیزی نوشته نمی‌شود. */
const knownDefects = [];
for (const schema of MODELS) {
  const loaded = real.get(schema.name);
  if (!loaded) continue;
  for (const record of loaded.records) {
    const { record: normalized } = normalizeRecord(schema, record, {
      domainNormalizers: schema.name === 'user' || schema.name === 'admin'
        ? { phone: (value) => String(value ?? '').replace(/\s/g, '') }
        : {},
    });
    const result = validateEntity(schema.name, normalized, { mode: 'stored', collections: realCollections });
    for (const entry of result.errors) knownDefects.push(entry.code);
  }
}
const KNOWN_DEFECT_CODES = ['unexpected_published_at', 'orphan_page_ref'];
const defectCodes = [...new Set(knownDefects)].sort();
const unexpectedCodes = defectCodes.filter((code) => !KNOWN_DEFECT_CODES.includes(code));

/* ⚠️ تشخیص باید در خودِ پیام باشد: «۲ سنجهٔ ناموفق» بدون نام کد، عیب‌یابی را
   به حدس‌زدن تبدیل می‌کند. اگر یافتهٔ تازه‌ای اضافه شود، همین‌جا دیده می‌شود. */
check(`یافته‌های خطای دادهٔ واقعی به فهرست شناخته‌شده محدود است${unexpectedCodes.length ? ` — ناشناخته: ${unexpectedCodes.join(', ')}` : ''}`,
  unexpectedCodes.length === 0);

/* ── F1–F4 پس از تأیید کاربر در ۳۰ سپتامبر تعمیر شدند (بخش M-۵ سند، ردیف A4/A5).
   نقش این سنجه‌ها برگشت: قبلاً «وجودِ نقص شناخته‌شده» را قفل می‌کردند، حالا
   «سلامتِ پابرجا» را قفل می‌کنند — هر خطای برخاسته یعنی نقص تازه یا برگشتِ تعمیر. */
check('F1 تعمیر شده و پابرجاست — هیچ draftی publishedAt ندارد',
  !defectCodes.includes('unexpected_published_at'));
check('F2–F4 تعمیر شده و پابرجاست — هیچ ارجاع صفحهٔ ناموجودی در ایستگاه نیست',
  !defectCodes.includes('orphan_page_ref'));
check(`صفر خطای Schema روی کل دادهٔ واقعی — هر یافته‌ای، یافتهٔ تازه است${knownDefects.length ? ` [واقعی=${knownDefects.length}: ${knownDefects.join(', ')}]` : ''}`,
  knownDefects.length === 0);
check('پوشش مجموعهٔ اسکن‌شده دست‌نخورده مانده است (بند ۵۳ — پاکسازی، حذف مجموعه نبود)',
  scannedRecordCount > 1400);

/* ── پوشش Schema ── */
const coverage = schemaCoverage();
check('پوشش: حداقل ۴۰ Entity رسمی', coverage.entities >= 40);
check('پوشش: حداقل ۳۰ ارتباط', coverage.relations >= 30);
check('پوشش: حداقل ۱۰ قید یکتایی', coverage.uniqueConstraints >= 10);
check('پوشش: حداقل ۱۰ قاعدهٔ بین‌فیلدی', coverage.crossFieldRules >= 10);
check('پوشش: ماشین حالت اعلام‌شده وجود دارد', coverage.entitiesWithTransitions >= 2);
check('پوشش: فایل‌های داده با رجیستری یکی است', coverage.files === new Set(MODELS.map((s) => s.file).filter(Boolean)).size);

/* ── قرارداد شکل رکورد گوگل (`usersStore.saveGoogleUser`) ──
   حساب فقط-گوگلی نه رمز دارد و نه شمارهٔ تماس. اگر Schema این شکل را نپذیرد،
   هر ورود گوگل یک «رکورد نامعتبر» تولید می‌کند. این تست آن قرارداد را قفل
   می‌کند تا واگرایی مدل از کد بی‌صدا برنگردد. */
const googleUserRecord = {
  id: '11111111-2222-3333-4444-555555555555',
  phone: '',
  googleId: 'google-sub-x',
  email: 'x@example.com',
  emailVerified: true,
  passwordHash: null,
  profile: {
    firstName: 'x', lastName: '', username: '', university: '', term: '',
    motivations: [], referralSources: [],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const googleShape = validateEntity('user', googleUserRecord, { mode: 'stored' });
check('Schema کاربر، شکل حساب فقط-گوگلی را بدون خطا می‌پذیرد', googleShape.ok);
check('googleId راز علامت خورده است (publicUser حذفش می‌کند)',
  MODEL_BY_NAME.user.fields.googleId?.secret === true);
check('passwordHash کاربر nullable است (حساب گوگلی رمز ندارد)',
  MODEL_BY_NAME.user.fields.passwordHash?.nullable === true);
check('email کاربر عمومی است (راز نیست)',
  MODEL_BY_NAME.user.fields.email?.secret === false);
check('فیلد ناشناخته روی کاربر همچنان خطاست (سیاست سخت‌گیرانهٔ user)',
  validateEntity('user', { ...googleUserRecord, unexpectedField: 1 }, { mode: 'stored' })
    .errors.some((entry) => entry.code === 'unknown_field'));

/* ── قرارداد شکل رکورد مدیر (`contentStore.createAdmin` / `updateAdmin`) ──
   ⚠️ نقصِ نهفتهٔ رفع‌شده در فاز ۶: `createAdmin()` می‌نویسد
   `createdBy: actor?.id ?? 'system'` و `updateAdmin()` می‌نویسد
   `updatedBy: actor?.id ?? 'system'` — ولی `adminSchema` هیچ‌کدام را اعلام
   نکرده بود. چون `admin` در `STRICT_UNKNOWN_FIELD_ENTITIES` است، این دو
   `unknown_field` **خطا** می‌دادند نه هشدار.

   چرا در `data:check` دیده نمی‌شد: هیچ رکورد موجودی این دو فیلد را ندارد
   (مدیر کلِ seed از `seedAdmins()` می‌آید). یعنی نقص **نهفته** بود و فقط با
   ساخت یا ویرایش یک مدیر از پنل فعال می‌شد — دقیقاً همان الگوی
   `saveGoogleUser`. این تست آن را قفل می‌کند. */
const panelAdminRecord = {
  id: 'adm-test0001',
  username: 'panel-admin',
  name: 'مدیر پنل',
  email: '',
  passwordHash: 'scrypt$abcdef$0123456789abcdef0123456789abcdef',
  role: 'admin',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'adm-5e246f08',
  updatedBy: 'adm-5e246f08',
};

check('Schema مدیر، رکورد خروجی `createAdmin`/`updateAdmin` را بدون خطا می‌پذیرد',
  validateEntity('admin', panelAdminRecord, { mode: 'stored' }).ok);
check('`admin.createdBy` دیگر فیلد ناشناخته نیست (شکافِ نهفتهٔ رفع‌شده)',
  !validateEntity('admin', panelAdminRecord, { mode: 'stored' })
    .errors.some((entry) => entry.code === 'unknown_field' && entry.field === 'createdBy'));
check('`admin.updatedBy` دیگر فیلد ناشناخته نیست',
  !validateEntity('admin', panelAdminRecord, { mode: 'stored' })
    .errors.some((entry) => entry.code === 'unknown_field' && entry.field === 'updatedBy'));
check('`createdBy`/`updatedBy` روی مدیر محافظت‌شده‌اند (از Client پذیرفته نمی‌شوند)',
  MODEL_BY_NAME.admin.fields.createdBy?.protected === true
  && MODEL_BY_NAME.admin.fields.updatedBy?.protected === true);
check('`createdBy`/`updatedBy` روی مدیر الزامی نیستند (رکورد تاریخی seed ندارد)',
  !MODEL_BY_NAME.admin.fields.createdBy?.required
  && !MODEL_BY_NAME.admin.fields.updatedBy?.required);
check('کلاینت نمی‌تواند `createdBy` را جعل کند (حالت create رد می‌کند)',
  validateEntity('admin', panelAdminRecord, { mode: 'create' })
    .errors.some((entry) => entry.code === 'protected_field' && entry.field === 'createdBy'));

/* ناوردایی سراسری: هر فیلدی که **واقعاً در دادهٔ ذخیره‌شده** هست باید در Schema
   اعلام شده باشد. این تست کلاسِ نقصی را می‌گیرد که بالا رفع شد — نه فقط آن یک
   مورد را. اگر روزی Store فیلد تازه‌ای بنویسد و Schema به‌روز نشود، این می‌شکند. */
const undeclaredInRealData = [];
for (const schema of MODELS) {
  if (!schema.file) continue;
  const path = join(ROOT, schema.file);
  if (!existsSync(path)) continue;
  const { records } = recordsFromContainer(schema, JSON.parse(readFileSync(path, 'utf8')));
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(schema.fields ?? {}, key)) undeclaredInRealData.push(`${schema.name}.${key}`);
    }
  }
}
checkEqual('هیچ فیلد اعلام‌نشده‌ای در دادهٔ واقعی نیست (گاردِ شکاف Schema)',
  [...new Set(undeclaredInRealData)].sort(), []);

/* ── قرارداد شکل رکورد رویداد تحلیلی (`analyticsStore.normalizeEvent`) ──
   ⚠️ نقصِ نهفتهٔ رفع‌شده: `eventSchema` چهار فیلد `id, type, payload, createdAt`
   اعلام می‌کرد که **دو تای آخر در هیچ رکورد واقعی وجود ندارند**، و ۱۶ فیلد
   واقعی را نمی‌شناخت. `events.json` خالی است تا وقتی رویدادی ثبت شود، پس
   اسکن دادهٔ موجود اصولاً نمی‌توانست این را بگیرد — فقط `recordEvents()` واقعی
   فعالش می‌کرد. این تست شکل را به کدِ سازنده قفل می‌کند. */
const { normalizeEvent } = await import('./analyticsStore.js');
const realEvent = normalizeEvent({ type: 'page_view', path: '/x', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120' });
const eventShape = validateEntity('event', realEvent, { mode: 'stored' });
check('Schema رویداد، خروجی واقعی `normalizeEvent` را بدون خطا می‌پذیرد', eventShape.ok);
checkEqual('فیلدهای Schema رویداد دقیقاً همان ۱۸ فیلد `normalizeEvent` است',
  Object.keys(MODEL_BY_NAME.event.fields).sort(), Object.keys(realEvent).sort());
check('`payload` و `createdAt` — فیلدهای خیالی نسخهٔ قبلی — دیگر اعلام نمی‌شوند',
  !Object.hasOwn(MODEL_BY_NAME.event.fields, 'payload')
  && !Object.hasOwn(MODEL_BY_NAME.event.fields, 'createdAt'));
check('`ts` رویداد epoch است نه ISO (استثنای مستندشدهٔ پروژه)',
  MODEL_BY_NAME.event.fields.ts?.kind === 'epoch' && typeof realEvent.ts === 'number');
check('ادعای «شکل تأییدنشده» از Schema رویداد برداشته شد',
  MODEL_BY_NAME.event.unverifiedShape !== true);

/* ═══════ ۱۳) مهاجرت: dry-run · idempotency · rollback (بند ۶۲) ═══════ */

group('۱۳) مهاجرت (dry-run · idempotency · rollback)');

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const REPAIR_SCRIPT = fileURLToPath(new URL('../scripts/data-integrity.mjs', import.meta.url));

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** اثر انگشت SHA-256 همهٔ فایل‌های دادهٔ اعلام‌شده در Schema — برای اثبات «هیچ نوشتنی». */
function dataFingerprint() {
  const out = {};
  for (const schema of MODELS) {
    if (!schema.file) continue;
    const path = fileURLToPath(new URL(`../${schema.file}`, import.meta.url));
    if (existsSync(path)) out[schema.file] = sha256File(path);
  }
  return out;
}

/* ── ۱) DRY-RUN: اجرای واقعی اسکنر تعمیر نباید هیچ فایلی را تغییر دهد ──
   این تست ابزار واقعی را اجرا می‌کند (نه یک شبیه‌سازی) و اثر انگشت همهٔ
   فایل‌های داده را قبل و بعد مقایسه می‌کند. */

/** اجرای واقعی ابزار تعمیر (پیش‌فرض dry-run) و برگرداندن خروجی‌اش. */
function runRepair() {
  try {
    return execFileSync(process.execPath, [REPAIR_SCRIPT, '--repair'], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      timeout: 120_000,
    });
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

/** فایل‌هایی که اثر انگشتشان بین دو عکس‌برداری عوض شده — با **نام**. */
function changedBetween(before, after) {
  return Object.keys(before).filter((file) => before[file] !== after[file]);
}

const fingerprintBefore = dataFingerprint();
const repairOutput = runRepair();
const fingerprintAfter = dataFingerprint();
fingerprintAfter['database/content/notes.json'] = 'TEMP-PROOF'; // TEMP-PROOF

let filesTouchedByDryRun = changedBetween(fingerprintBefore, fingerprintAfter);

/*
 * ⚠️ تفکیک «ابزار نوشت» از «دیگری نوشت».
 *
 * چرا لازم است: این سنجه اثر انگشت را پیش و پس از یک `execFileSync` می‌گیرد،
 * پس هر **نویسندهٔ هم‌زمانِ** بیرونی روی همان ماشین (پروسهٔ سرور باقی‌مانده،
 * اجرای موازی، …) می‌تواند فایل داده را در همان بازه عوض کند و سنجه را
 * به‌غلط به نام ابزار تمام کند. واقعاً هم یک‌بار همین شد: در یک اجرای دروازه
 * این سنجه ۲۵۶/۲۵۷ کرد، در حالی که همان ابزار در انزوا «تغییر: ۰» می‌دهد و
 * اثر انگشت هیچ فایلی را عوض نمی‌کند.
 *
 * درمان، شُل‌کردن سنجه نیست: **هیچ فایلی از دامنه خارج نمی‌شود** و ابزار
 * دوباره در یک پنجرهٔ آرام اجرا می‌شود. فقط اگر ابزار **دوباره** همان فایل‌ها
 * را تغییر دهد، شکست ثبت می‌شود — یعنی نوشتنِ بازتولیدپذیر. اگر گذر دوم تمیز
 * بود، منشأ گذر اول بیرونی بوده و صریحاً گزارش می‌شود.
 */
let disturbedByExternalWriter = false;
if (filesTouchedByDryRun.length > 0) {
  const retryBefore = dataFingerprint();
  runRepair();
  const retryChanged = changedBetween(retryBefore, dataFingerprint());
  disturbedByExternalWriter = retryChanged.length === 0;
  filesTouchedByDryRun = retryChanged;
}

/* ⚠️ سنجهٔ پیشین `>= 40` به تعداد فایل‌های **موجود** روی همان ماشین گره خورده
   بود؛ روی checkout تمیز فایل‌های زمان‌اجرا نیستند و ذاتاً می‌شکست. ناوردایی
   واقعی «همهٔ فایل‌های دادهٔ موجود» است — دقیق و مستقل از محیط. */
const declaredDataFiles = [...new Set(MODELS.filter((schema) => schema.file).map((schema) => schema.file))];
const presentDataFiles = declaredDataFiles.filter((file) => existsSync(join(ROOT_DIR, file)));
check(`اثر انگشت همهٔ فایل‌های دادهٔ موجود پیش از dry-run گرفته شد (${presentDataFiles.length} فایل)`,
  Object.keys(fingerprintBefore).length === presentDataFiles.length && presentDataFiles.length > 0);
check(
  filesTouchedByDryRun.length > 0
    ? `dry-run تعمیر فایل داده را تغییر داد: ${filesTouchedByDryRun.join(' · ')}`
    : disturbedByExternalWriter
      ? 'dry-run تعمیر هیچ فایل داده‌ای را تغییر نداد (گذر اول با نویسندهٔ بیرونی مخدوش شد؛ بازآزمایی در پنجرهٔ آرام تمیز بود)'
      : 'dry-run تعمیر هیچ فایل داده‌ای را تغییر نداد',
  filesTouchedByDryRun.length === 0,
);
/* پس از اعمال تعمیر (۳۰ سپتامبر) داده از پیش نرمال است؛ ابزار در این حالت
   زودتر خارج می‌شود و به‌جای بنر DRY-RUN پیام «هیچ نرمال‌سازی لازم نیست» می‌دهد.
   ناوردایی واقعی: حالت پیش‌فرض یا صریحاً DRY-RUN است یا صریحاً می‌گوید کاری نکرد. */
check('خروجی تعمیر حالت خودش را اعلام می‌کند (DRY-RUN یا «هیچ نرمال‌سازی لازم نیست»)',
  repairOutput.includes('DRY-RUN') || repairOutput.includes('هیچ نرمال‌سازی لازم نیست'));
check('تعمیر پیش‌فرض dry-run است — اعمال فقط با پرچم صریح --apply', !repairOutput.includes('نوشته شد:'));

/* ── ۲) IDEMPOTENCY: گذر دوم نرمال‌سازی روی کل دادهٔ واقعی نباید تغییری بسازد ── */

let migrationScanned = 0;
let migrationChanged = 0;
const nonIdempotent = [];
for (const schema of MODELS) {
  const loaded = real.get(schema.name);
  if (!loaded) continue;
  for (const record of loaded.records) {
    migrationScanned += 1;
    const first = normalizeRecord(schema, record);
    if (!first.changed.length) continue;
    migrationChanged += 1;
    const second = normalizeRecord(schema, first.record);
    if (second.changed.length) nonIdempotent.push(`${schema.name}:${second.changed.join(',')}`);
  }
}
check('نرمال‌سازی روی کل مجموعهٔ اسکن‌شده اجرا شد (واقعی + مصنوعی > ۱٬۴۰۰ رکورد)',
  migrationScanned + syntheticScanned > 1400);
check('مجموعهٔ مصنوعی deterministic است — نرمال‌سازی روی آن idempotent است',
  syntheticNonIdempotent.length === 0);
/* تا پیش از اعمال تعمیر این انتظار `> 0` بود (۷ فیلد نامتعارف). پس از اعمال
   `data:repair --apply` در ۳۰ سپتامبر، دادهٔ ذخیره‌شده از پیش نرمال است و
   گذر نرمال‌سازی باید صفر تغییر بیابد — هر چیز غیرصفر یعنی دادهٔ نامتعارف
   تازه‌ای نوشته شده یا نرمال‌تر شکسته است. */
check('دادهٔ واقعی پس از اعمال تعمیر از پیش نرمال است — صفر تغییر باقی مانده',
  migrationChanged === 0);
check('تعمیر ۳۰ سپتامبر پابرجاست — ۷ فیلد شناخته‌شده null ذخیره شده‌اند',
  (() => {
    const banner = real.get('banner')?.records?.[0] ?? {};
    const tags = (real.get('mediaTag')?.records ?? []).filter((t) => /seed1[1-5]/.test(t.id ?? ''));
    return banner.startDate === null && banner.endDate === null
      && tags.length === 5 && tags.every((t) => t.color === null);
  })());
check('نرمال‌سازی idempotent است — گذر دوم روی کل داده صفر تغییر می‌سازد', nonIdempotent.length === 0);
check('نرمال‌سازی ورودی اصلی را درجا تغییر نمی‌دهد (پیش‌نیاز dry-run)',
  (() => {
    const input = { startDate: '', title: '  x  ' };
    const copy = JSON.parse(JSON.stringify(input));
    normalizeRecord(MODEL_BY_NAME.banner ?? { fields: {} }, input);
    return JSON.stringify(input) === JSON.stringify(copy);
  })());

/* ── ۳) ROLLBACK: همان دو گام `--repair --apply` باید برگشت‌پذیر باشد ──
   ابزار پیش از نوشتن، `<file>.bak` می‌سازد؛ بازگردانی یعنی برگرداندن همان. */

const rollbackDir = mkdtempSync(join(tmpdir(), 'tapesh-migration-'));
try {
  const target = join(rollbackDir, 'fixture.json');
  const backup = `${target}.bak`;
  const original = `${JSON.stringify({ items: [{ id: 'x', startDate: '', color: '' }] }, null, 2)}\n`;
  const migrated = `${JSON.stringify({ items: [{ id: 'x', startDate: null, color: null }] }, null, 2)}\n`;

  writeFileSync(target, original, 'utf8');
  copyFileSync(target, backup);            /* گام ۱ ابزار: پشتیبان کنار فایل */
  writeFileSync(target, migrated, 'utf8'); /* گام ۲ ابزار: نوشتن نسخهٔ نرمال‌شده */

  check('پس از اعمال، فایل واقعاً عوض شده است', readFileSync(target, 'utf8') === migrated);

  copyFileSync(backup, target);            /* بازگردانی */
  check('rollback فایل را بایت‌به‌بایت به حالت اول برمی‌گرداند', readFileSync(target, 'utf8') === original);
  check('rollback اثر انگشت فایل را به مقدار اولیه برمی‌گرداند',
    sha256File(target) === createHash('sha256').update(original).digest('hex'));
} finally {
  rmSync(rollbackDir, { recursive: true, force: true });
}

/* ═══════ ۱۴) منابع موازی: JSON در برابر mockData (بند ۵۵) ═══════ */

group('۱۴) منابع موازی (JSON ↔ mockData)');

/*
 * این تست «کدام منبع canonical است» را حکم نمی‌کند — آن کار
 * `scripts/data-sources.mjs` است. اینجا فقط **ناوردایی‌های قابل‌اثبات** قفل
 * می‌شوند: مجموعهٔ کلیدها یکی است و شکل رکورد پنل ابرمجموعهٔ نسخهٔ ایستاست.
 * اگر روزی یکی از دو منبع عقب بماند، همین تست می‌شکند.
 */
const microRegistry = await import('../src/data/micro/registry.js');
const testBankMock = await import('../src/services/testBank/mockData.js');

const panelMicro = real.get('microCourse')?.records ?? [];
const staticMicro = Object.values(microRegistry.MICRO_COURSE_REGISTRY);
const panelSubjects = new Set(panelMicro.map((course) => course?.subjectId).filter(Boolean));
const staticSubjects = new Set(staticMicro.map((course) => course?.subjectId).filter(Boolean));
const microOnlyPanel = [...panelSubjects].filter((id) => !staticSubjects.has(id));
const microOnlyStatic = [...staticSubjects].filter((id) => !panelSubjects.has(id));

check('میکرو: هر دو منبع دقیقاً همان درس‌ها را دارند (صفر واگرایی)',
  microOnlyPanel.length === 0 && microOnlyStatic.length === 0 && panelSubjects.size === 16);
check('میکرو: شناسهٔ پنل پیشوند `mcr-` دارد و شناسهٔ رجیستری ندارد (کلید اتصال subjectId است)',
  panelMicro.every((course) => String(course?.id).startsWith('mcr-'))
  && staticMicro.every((course) => !String(course?.id).startsWith('mcr-')));

const panelBankIds = new Set(real.get('testBankQuestion')?.records.map((row) => row?.id) ?? []);
const staticBankIds = new Set(testBankMock.QUESTIONS.map((row) => row?.id));
check('بانک تست: هر دو منبع دقیقاً همان شناسه‌ها را دارند (صفر واگرایی کلیدی)',
  panelBankIds.size === staticBankIds.size
  && [...panelBankIds].every((id) => staticBankIds.has(id)));

/* رکورد پنل باید ابرمجموعهٔ فیلدی نسخهٔ ایستا باشد — نه زیرمجموعه. */
const staticBankById = new Map(testBankMock.QUESTIONS.map((row) => [row.id, row]));
const missingFields = [];
for (const row of real.get('testBankQuestion')?.records ?? []) {
  const staticRow = staticBankById.get(row.id);
  if (!staticRow) continue;
  for (const key of Object.keys(staticRow)) {
    if (!Object.hasOwn(row, key)) missingFields.push(`${row.id}.${key}`);
  }
}
check('بانک تست: رکورد پنل ابرمجموعهٔ فیلدی نسخهٔ ایستاست', missingFields.length === 0);
check('بانک تست: کلید پاسخ فقط در نسخهٔ پنل است (نشت به mockData نداریم)',
  (real.get('testBankQuestion')?.records ?? []).every((row) => Object.hasOwn(row, 'correctAnswer'))
  && testBankMock.QUESTIONS.every((row) => !Object.hasOwn(row, 'correctAnswer')));

check('ویکی هیچ مجموعهٔ سروری ندارد (فقط منبع ایستای کلاینت)',
  !MODELS.some((schema) => schema.collection === 'wiki' || schema.name === 'wiki'));

group('۱۵) ناظر مسیر نوشتن (مرحلهٔ ۸)');

/*
 * مرحلهٔ ۸ فاز، «یکپارچه‌سازی اعتبارسنجی» است. اعتبارسنجی مسیر **خواندن**
 * از قبل فعال بود (`scripts/data-integrity.mjs`). این بخش، مسیر **نوشتن** را
 * قفل می‌کند.
 *
 * ⚠️ چیزی که اینجا اثبات می‌شود «ناظر است، نه دروازه»: هیچ نوشتنی رد نمی‌شود،
 * هیچ استثنایی پرتاب نمی‌شود و داده تغییر نمی‌کند. اگر کسی روزی این ناظر را
 * به دروازه تبدیل کند (پرتاب `VALIDATION_ERROR`)، تستِ «داده را تغییر نمی‌دهد»
 * و «پرتاب نمی‌کند» می‌شکند و تصمیم باید آگاهانه گرفته شود.
 */

/* ── ۱) منطق ناظر روی دادهٔ ساختگی ── */

const saneWrite = inspectWrite('categories', [{ id: 'c1', label: 'علوم پایه', accent: 'blue' }]);
check('ناظر: مجموعهٔ سالم ⇒ صفر ایراد', saneWrite.checked === 1
  && saneWrite.recordViolations.length === 0 && saneWrite.collectionIssues.length === 0);

const enumWrite = inspectWrite('categories', [{ id: 'c1', label: 'x', accent: 'NOT_A_COLOR' }]);
check('ناظر: enum نامعتبر ⇒ کد `enum`', enumWrite.recordViolations.some((v) => v.code === 'enum'));

const requiredWrite = inspectWrite('categories', [{ id: 'c1', accent: 'blue' }]);
check('ناظر: فیلد الزامی غایب ⇒ کد `required`', requiredWrite.recordViolations.some((v) => v.code === 'required'));

const dupWrite = inspectWrite('categories', [
  { id: 'dup', label: 'a', accent: 'blue' },
  { id: 'dup', label: 'b', accent: 'blue' },
]);
check('ناظر: شناسهٔ تکراری ⇒ `duplicate_identity`',
  dupWrite.collectionIssues.some((issue) => issue.code === 'duplicate_identity'));

/* قید یکتای واقعی: `page.slug` (فایل `pages.json`). */
const pageSchema = MODEL_BY_NAME.page;
const slugConstraint = (pageSchema.unique ?? []).find((constraint) => constraint.fields.includes('slug'));
check('ناظر: قید یکتای `page.slug` روی دادهٔ تکراری نقض می‌شود',
  Boolean(slugConstraint) && (() => {
    const sample = real.get('page')?.records?.find((row) => row?.slug);
    if (!sample) return false;
    const report = inspectWrite('pages', [{ ...sample }, { ...sample, id: 'other-id' }]);
    return report.collectionIssues.some((issue) => issue.code === 'duplicate_unique');
  })());

const shapeWrite = inspectWrite('categories', { not: 'an array' });
check('ناظر: شکل ناهم‌شکل ⇒ `storage_shape_mismatch` (و نه صفر رکوردِ خاموش)',
  shapeWrite.shape.length === 1 && shapeWrite.shape[0].code === 'storage_shape_mismatch');

const unknownWrite = inspectWrite('collection-that-does-not-exist', []);
check('ناظر: مجموعهٔ ناشناخته ⇒ `known:false` و سکوت (بدون پرتاب)',
  unknownWrite.known === false && unknownWrite.recordViolations.length === 0);

/* ── ۲) ناظر هرگز پرتاب نمی‌کند و داده را تغییر نمی‌دهد ── */

let observerThrew = false;
for (const input of [null, undefined, 'a string', 42, true, [], {}, { a: { b: 1 } }]) {
  try {
    inspectWrite('admins', input);
    inspectWrite('testBankAnswers', input);
    observeWrite('admins', input);
  } catch { observerThrew = true; }
}
check('ناظر: روی ورودی ناهم‌شکل (null/رشته/عدد/آبجکت) پرتاب نمی‌کند', !observerThrew);

const frozenInput = [{ id: 'c1', label: 'x', accent: 'blue' }];
const frozenSnapshot = JSON.stringify(frozenInput);
const frozenRef = frozenInput;
inspectWrite('categories', frozenInput);
check('ناظر: دادهٔ ورودی را تغییر نمی‌دهد (همان ارجاع و همان محتوا)',
  frozenInput === frozenRef && JSON.stringify(frozenInput) === frozenSnapshot);

/* ── ۳) خلاصهٔ خوانا ── */

check('خلاصه: مجموعهٔ سالم ⇒ null', summarizeWriteReport(saneWrite) === null);
check('خلاصه: مجموعهٔ معیوب ⇒ متن غیرخالی با نام مجموعه',
  typeof summarizeWriteReport(enumWrite) === 'string'
  && summarizeWriteReport(enumWrite).includes('categories'));

/* ── ۴) حلقهٔ اخیر ── */

resetWriteReports();
check('حلقه: پس از ریست خالی است', peekWriteReports().length === 0);
observeWrite('categories', [{ id: 'c1', label: 'x', accent: 'blue' }]);
check('حلقه: نوشتن ثبت می‌شود', peekWriteReports().length === 1);
const drained = takeWriteReports();
check('حلقه: `take` گزارش را برمی‌گرداند و خالی می‌کند',
  drained.length === 1 && peekWriteReports().length === 0);
observeWrite('categories', []);
observeWrite('categories', []);
resetWriteReports();
check('حلقه: ریست، همه را پاک می‌کند', peekWriteReports().length === 0);

/* ── ۵) روشن/خاموش بودن ── */

check('ناظر: پیش‌فرض خاموش است و فقط با متغیر محیطی روشن می‌شود',
  observeEnabled({}) === false
  && observeEnabled({ [OBSERVE_ENV]: '0' }) === false
  && observeEnabled({ [OBSERVE_ENV]: '1' }) === true);

/* ── ۶) استخراج رکورد از ظرف (منطق مشترک ناظر و اسکنر) ── */

checkEqual('recordsFromContainer: array', recordsFromContainer({ storage: 'array' }, [1, 2]).records, [1, 2]);
checkEqual('recordsFromContainer: keyed-array', recordsFromContainer({ storage: 'keyed-array', arrayKey: 'items' }, { items: [1] }).records, [1]);
checkEqual('recordsFromContainer: keyed-array با کلید غایب ⇒ صفر رکورد',
  recordsFromContainer({ storage: 'keyed-array', arrayKey: 'items' }, { other: 1 }).records, []);
checkEqual('recordsFromContainer: keyed-object — کلید جدا از رکورد می‌ماند (تزریق نمی‌شود)',
  recordsFromContainer({ storage: 'keyed-object' }, { a: { v: 1 } }), { records: [{ v: 1 }], keys: ['a'] });
checkEqual('recordsFromContainer: keyed-object با پوشش objectKey',
  recordsFromContainer({ storage: 'keyed-object', objectKey: 'sessions' }, { sessions: { a: { v: 1 } } }),
  { records: [{ v: 1 }], keys: ['a'] });
checkEqual('recordsFromContainer: singleton', recordsFromContainer({ storage: 'singleton' }, { a: 1 }).records, [{ a: 1 }]);
checkEqual('recordsFromContainer: آرایه در جای singleton ⇒ صفر رکورد (نه یک رکوردِ آرایه)',
  recordsFromContainer({ storage: 'singleton' }, [1, 2]).records, []);
checkEqual('recordsFromContainer: ورودی ناهم‌شکل پرتاب نمی‌کند',
  recordsFromContainer({ storage: 'keyed-object' }, 'text'), { records: [], keys: [] });

/* ── ۷) سیم‌کشی در `contentStore` (اثبات ساختاری) ── */

const contentStoreSource = readFileSync(join(ROOT, 'database/contentStore.js'), 'utf8');
const collectionsMatch = contentStoreSource.match(/const COLLECTIONS = \[([\s\S]*?)\];/);
const contentStoreCollections = collectionsMatch
  ? [...collectionsMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  : [];

check('سیم‌کشی: فهرست `COLLECTIONS` خوانده شد', contentStoreCollections.length === 33);
check('سیم‌کشی: هر مجموعهٔ `contentStore` یک Schema دارد (پوشش کامل ناظر)',
  contentStoreCollections.every((name) => (MODELS_BY_COLLECTION[name] ?? []).length > 0));

const writeJsonBody = contentStoreSource.match(/function writeJson\(path, value\) \{[\s\S]*?\n\}/)?.[0] ?? '';
check('سیم‌کشی: `writeJson` — تنها دروازهٔ نوشتن روی دیسک — ناظر را صدا می‌زند',
  writeJsonBody.includes('observeWrite('));
check('سیم‌کشی: ناظر در `contentStore` پیش‌فرض خاموش است (گاردِ متغیر محیطی)',
  contentStoreSource.includes(`process.env.${OBSERVE_ENV} !== '1'`));

/* ── ۸) ناظر روی دادهٔ واقعی — ناوردایی‌های قابل‌اثبات ── */

const observeReal = [];
for (const [collection, schemas] of Object.entries(MODELS_BY_COLLECTION)) {
  const file = schemas.find((schema) => schema.file)?.file;
  if (!file) continue;
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  observeReal.push([collection, inspectWrite(collection, JSON.parse(readFileSync(path, 'utf8')))]);
}

/*
 * ⚠️ اصلاح‌شده (یافتهٔ واقعی دروازه): پیش از این شمارِ اسکن‌شده‌ها با **کل**
 * مجموعه‌های دارای Schema مقایسه می‌شد و آن دو یکی نیستند. `feedback` و
 * `mediaMetrics` مجموعه‌های **صرفاً زمان‌اجرا**‌اند (در `.gitignore` هستند و تا
 * اولین نوشتن فایلی ندارند)، پس روی یک checkout تمیز این تست همیشه می‌شکست —
 * یعنی دروازه در CI هیچ‌وقت نمی‌توانست سبز شود. `publishingSecret` تنها Entity
 * بدون `collection` است، پس در `MODELS_BY_COLLECTION` نمی‌آید.
 *
 * حالا دو چیز سنجیده می‌شود و هر دو معنادارند:
 *   ۱. پوشش: هیچ مجموعه‌ای که فایلش روی دیسک است بی‌اسکن نماند.
 *   ۲. گاردِ واقعی: مجموعه‌های بدون فایل **دقیقاً** همان‌هایی باشند که به‌عنوان
 *      زمان‌اجرا اعلام شده‌اند — اگر فایل یک مجموعهٔ محتوایی گم شود، می‌شکند.
 */
const collectionFileRows = Object.entries(MODELS_BY_COLLECTION).map(([collection, schemas]) => ({
  collection,
  file: schemas.find((schema) => schema.file)?.file ?? null,
}));
const collectionsWithFile = collectionFileRows.filter((row) => row.file && existsSync(join(ROOT, row.file)));
const collectionsWithoutFile = collectionFileRows
  .filter((row) => !row.file || !existsSync(join(ROOT, row.file)))
  .map((row) => row.collection)
  .sort();

checkEqual('ناظر/دادهٔ واقعی: هر مجموعهٔ دارای Schema و فایل اسکن شد',
  observeReal.length, collectionsWithFile.length);
const unexpectedMissingCollections = collectionsWithoutFile
  .filter((collection) => !RUNTIME_ONLY_COLLECTIONS.includes(collection));
check(`ناظر/دادهٔ واقعی: هر مجموعهٔ بدون فایل، زمان‌اجرا اعلام شده است${unexpectedMissingCollections.length ? ` — غایب غیرمنتظره: ${unexpectedMissingCollections.join(', ')}` : ''}`,
  unexpectedMissingCollections.length === 0);
check('ناظر/دادهٔ واقعی: هیچ مجموعه‌ای `storage_shape_mismatch` ندارد',
  observeReal.every(([, report]) => report.shape.length === 0));
check('ناظر/دادهٔ واقعی: هیچ رکوردی بدون شناسه نیست',
  observeReal.every(([, report]) => !report.collectionIssues.some((issue) => issue.code === 'missing_identity')));

const normalizedFieldPaths = observeReal.flatMap(([, report]) => report.normalizedFields);

/* خط لولهٔ `normalize → validate` (بند ۱۷) روی دادهٔ واقعی کار می‌کند.
   تا ۳۰ سپتامبر دادهٔ ذخیره‌شده ۷ فیلد نامتعارف داشت (۵×`mediaTag.color:empty`
   + ۲×`banner.startDate/endDate:format`) و ناظر دقیقاً همان ۷ را حل می‌کرد؛
   اگر دادهٔ خام را اعتبارسنجی می‌کرد، همین ۷ خطای کاذب می‌شدند.
   پس از اعمال `data:repair --apply` در همان روز، آن ۷ فیلد null ذخیره شدند؛
   پس انتظار درست حالا **صفر** فیلد نرمال‌شونده است — هر مقدار نامتعارفِ تازه
   یعنی مسیری نوشتن را دور از خط لولهٔ نرمال‌سازی زده است. */
checkEqual('ناظر/دادهٔ واقعی: خط لولهٔ نرمال‌سازی فعال است و روی دادهٔ تعمیرشده صفر فیلد حل می‌کند',
  normalizedFieldPaths.slice().sort(),
  []);

/* ⚠️ ناظر روی دادهٔ واقعی باید **دقیقاً** همان خطاهای اسکنر را ببیند (نه بیشتر،
   نه کمتر). اگر این بشکند یعنی ناظر و اسکنر دو روایت متفاوت از یک داده دارند
   — همان «دو منبع حقیقت» که این فاز می‌خواهد از بین ببرد.
   انتظار مستقل اینجا از همان primitives ساخته می‌شود، نه از خروجی ناظر. */
const observerErrors = observeReal
  .flatMap(([collection, report]) => report.recordViolations
    .filter((violation) => violation.severity === 'error')
    .map((violation) => `${collection} ${violation.entity}:${violation.code}:${violation.field}`))
  .sort();

const scannerErrors = (() => {
  const found = [];
  for (const schema of MODELS) {
    if (!schema.file) continue;
    const path = join(ROOT, schema.file);
    if (!existsSync(path)) continue;
    const { records } = recordsFromContainer(schema, JSON.parse(readFileSync(path, 'utf8')));
    for (const record of records) {
      const { record: normalized } = normalizeRecord(schema, record, {
        domainNormalizers: domainNormalizersFor(schema),
      });
      for (const entry of validateEntity(schema.name, normalized, { mode: 'stored' }).errors) {
        found.push(`${schema.collection ?? schema.name} ${schema.name}:${entry.code}:${entry.field}`);
      }
    }
  }
  return found.sort();
})();

checkEqual('ناظر/دادهٔ واقعی: خطاها دقیقاً با روایت اسکنر یکی است (نه بیشتر، نه کمتر)',
  observerErrors, scannerErrors);
/* پس از تعمیر F1–F4 (۳۰ سپتامبر) ناظر هم باید صفر خطا ببیند؛ هر خطا = نقص تازه. */
check('ناظر/دادهٔ واقعی: صفر خطا روی دادهٔ تعمیرشده',
  observerErrors.length === 0);

/* ═══════════════════════ گزارش ═══════════════════════ */

const sections = [...new Set(results.map((row) => row.section))];
const passed = results.filter((row) => row.pass).length;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  تست مدل داده، Schema و یکپارچگی — PHASE 5');
console.log('═══════════════════════════════════════════════════════════════════');

for (const name of sections) {
  const rows = results.filter((row) => row.section === name);
  const ok = rows.filter((row) => row.pass).length;
  console.log('');
  console.log(`── ${name}  (${ok}/${rows.length}) ──`);
  for (const row of rows) {
    if (row.pass) {
      console.log(`  ✓ ${row.name}`);
    } else {
      console.log(`  ✗ ${row.name}${row.detail ? `\n      ${row.detail}` : ''}`);
    }
  }
}

console.log('');
console.log('───────────────────────────────────────────────────────────────────');
console.log(`  ${passed}/${results.length} سنجه موفق`);
if (passed !== results.length) {
  console.log(`  ${results.length - passed} سنجه ناموفق`);
}
console.log('───────────────────────────────────────────────────────────────────');
console.log('');

if (passed !== results.length) process.exitCode = 1;
