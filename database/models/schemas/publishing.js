/*
 * Schemaهای دامنهٔ «انتشار» — کانال، لاگ ارسال و رازها.
 *
 * ⚠️ مرز حساس (بند ۴۰ و ۵۶):
 *   • توکن ربات **هرگز** داخل رکورد کانال یا لاگ نمی‌آید. توکن‌ها در
 *     `database/publishing.secrets.json` (مجوز ۰۶۰۰، خارج از Git) زندگی می‌کنند
 *     و کلیدشان شناسهٔ کانال است.
 *   • `publishLog` فقط *منبع* توکن را ثبت می‌کند (`channel` / `none`)، نه
 *     مقدارش. `tokenSource` نامش شبیه راز است ولی یک Enum است — نباید در
 *     فهرست فیلدهای راز قرار بگیرد وگرنه از خروجی لاگ بی‌دلیل حذف می‌شود.
 *   • شناسهٔ کانال (`ch-…`) و شناسهٔ توکن قاطی نمی‌شوند: کلید در فایل راز
 *     همان `channelId` است، ولی مقدار توکن هرگز در رکورد کانال تکرار نمی‌شود.
 */

import {
  arr, bool, describe, enumOf, id, json, num, obj, ref, required, serverOnly,
  str, strArray, timestamp,
} from '../fields.js';
import { MEDIA_PLATFORMS, PUBLISH_ERROR_CODES, PUBLISH_LOG_STATUSES, PUBLISH_TOKEN_SOURCES } from '../enums.js';

/* ─────────────────────────── کانال انتشار ─────────────────────────── */

export const publishChannelSchema = {
  name: 'publishChannel',
  collection: 'publishChannels',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/publishChannels.json',
  description: 'کانال مقصد انتشار. توکن اینجا نیست — فقط در فایل راز.',
  fields: {
    id: required(id({ prefix: 'ch' })),
    platform: describe(required(enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' })), 'پلتفرم مقصد'),
    name: required(str({ min: 1, max: 200, allowEmpty: false })),
    /* شناسهٔ مقصد در پلتفرم (`@mytapesh`، `-1004445358153`، `11252784`) */
    chatId: describe(required(str({ min: 1, max: 200, allowEmpty: false })), 'شناسهٔ مقصد در پلتفرم'),
    isActive: bool(),
    disableNotification: bool(),
    note: str({ max: 2000 }),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
    createdBy: ref('admins', { soft: true }),
    createdByName: str({ max: 120 }),
    updatedBy: ref('admins', { soft: true }),
    updatedByName: str({ max: 120 }),
    lastSentAt: { ...timestamp(), nullable: true },
    lastStatus: { ...enumOf(PUBLISH_LOG_STATUSES, { name: 'PUBLISH_LOG_STATUSES' }), nullable: true },
    lastError: str({ max: 2000 }),
  },
  crossField: ['publishChannelLastStatus'],
};

/* ─────────────────────────── لاگ انتشار ─────────────────────────── */

export const publishLogSchema = {
  name: 'publishLog',
  collection: 'publishLog',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/publishLog.json',
  description: 'لاگ هر تلاش انتشار. فقط منبع توکن ثبت می‌شود، نه مقدارش.',
  fields: {
    id: required(id({ prefix: 'pl' })),
    /* ⚠️ ارجاع نرم: لاگ تاریخی باید بماند حتی اگر کانال حذف شود.
       یافتهٔ فاز ۵: دو رکورد به کانال حذف‌شدهٔ `ch-p5yo48cgn` اشاره می‌کنند. */
    channelId: describe(ref('publishChannels', { soft: true }), 'کانال مقصد — ارجاع نرم (لاگ تاریخی)'),
    channelName: str({ max: 200 }),
    platform: enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' }),
    platformLabel: str({ max: 120 }),
    status: describe(required(enumOf(PUBLISH_LOG_STATUSES, { name: 'PUBLISH_LOG_STATUSES' })), 'نتیجهٔ ارسال'),
    error: str({ max: 2000 }),
    errorCode: { ...enumOf(PUBLISH_ERROR_CODES, { name: 'PUBLISH_ERROR_CODES' }), nullable: true },
    reason: str({ max: 600 }),
    /* نامش گمراه‌کننده است ولی راز نیست: یک Enum است */
    tokenSource: describe(enumOf(PUBLISH_TOKEN_SOURCES, { name: 'PUBLISH_TOKEN_SOURCES' }), 'منبع توکن — مقدار توکن نیست'),
    adminId: ref('admins', { soft: true }),
    adminName: str({ max: 120 }),
    at: timestamp(),
    contentPreview: str({ max: 2000, trim: false }),
    messages: arr(json(), { max: 20 }),
    /* بدنهٔ درخواست ارسالی به پلتفرم — نباید توکن داشته باشد */
    request: json({ maxKeys: 30 }),
    source: { ...json({ maxKeys: 20 }), nullable: true },
  },
};

/* ─────────────────────────── رازهای انتشار ─────────────────────────── */

/**
 * فایل راز انتشار — شکل `{ version, tokens: { channelId: token } }`.
 *
 * این Entity **هرگز** در پاسخ هیچ API نمی‌آید. Schema فقط برای این است که
 * اسکنر یکپارچگی بتواند شکل فایل را بررسی کند و مطمئن شود توکن‌ها به جای
 * دیگری نشت نکرده‌اند. `secret: true` روی هر دو فیلد یعنی حتی اگر روزی کسی
 * این Schema را در مسیر سریال‌سازی بگذارد، مقدار بیرون نمی‌رود.
 */
export const publishingSecretSchema = {
  name: 'publishingSecret',
  collection: null,
  storage: 'singleton',
  identityField: null,
  file: 'database/publishing.secrets.json',
  description: 'توکن ربات انتشار — کلید = شناسهٔ کانال. هرگز از سرور بیرون نمی‌رود.',
  sensitiveFile: true,
  fields: {
    version: describe(required(num({ min: 1, max: 1000, int: true })), 'نسخهٔ قالب فایل راز'),
    tokens: describe(
      { ...obj({}, { allowUnknown: true }), secret: true },
      'نگاشت channelId → توکن ربات',
    ),
  },
  deepCheck: 'publishingSecretsShape',
};

export const PUBLISHING_SCHEMAS = [publishChannelSchema, publishLogSchema, publishingSecretSchema];
