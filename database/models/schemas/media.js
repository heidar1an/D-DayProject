/*
 * Schemaهای دامنهٔ «مرکز رسانه» — ۱۲ Entity + فراداده.
 *
 * مرجع Enumها `mediaStore.js` است؛ اینجا فقط شکل داده و ارتباط‌ها اعتبارسنجی
 * می‌شود. منطق گردش کار و مجوزها دست‌نخورده می‌ماند.
 *
 * نکتهٔ کلیدی مدل: `seed: true` یعنی «دادهٔ نمونهٔ اولیه». این پرچم **حذف
 * نمی‌شود** و نباید معادل «دادهٔ بی‌ارزش» گرفته شود — دادهٔ نمونه در محیط
 * توسعه و دمو کاربرد واقعی دارد.
 */

import {
  arr, bool, count, describe, enumOf, hexColor, id, json, num, obj, percent,
  ref, required, serverOnly, str, strArray, timestamp,
} from '../fields.js';
import {
  MEDIA_ACCOUNT_KINDS, MEDIA_ASSET_KINDS, MEDIA_CAMPAIGN_STATUSES, MEDIA_CONTENT_STATUSES,
  MEDIA_CONTENT_TRANSITIONS, MEDIA_CONTENT_TYPES, MEDIA_ENTITY_TYPES, MEDIA_INBOX_KINDS,
  MEDIA_INBOX_STATUSES, MEDIA_MENTION_SENTIMENTS, MEDIA_NOTIFICATION_KINDS,
  MEDIA_NOTIFICATION_LEVELS, MEDIA_PLATFORMS, MEDIA_TAG_KINDS, MEDIA_TEAM_ROLES,
  MEDIA_UTM_MEDIUMS,
} from '../enums.js';

/* ─────────────────────────── پلتفرم ─────────────────────────── */

export const mediaPlatformSchema = {
  name: 'mediaPlatform',
  collection: 'mediaPlatforms',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaPlatforms.json',
  description: 'پلتفرم ثبت‌شده در مرکز رسانه. شناسه‌اش همان نام پلتفرم است.',
  fields: {
    id: describe(required(enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' })), 'شناسهٔ پلتفرم — یکی از چهار پلتفرم پشتیبانی‌شده'),
    label: required(str({ min: 1, max: 120, allowEmpty: false })),
    description: str({ max: 1000 }),
    logo: str({ max: 400 }),
    isActive: bool(),
    managerId: ref('mediaTeam', { nullable: true }),
    notes: str({ max: 2000 }),
    seed: describe(bool(), 'دادهٔ نمونهٔ اولیه'),
    startedAt: describe(timestamp({ dateOnly: true, nullable: true }), 'تاریخ شروع فعالیت'),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
    createdBy: serverOnly(str({ max: 80 })),
    createdByName: str({ max: 120 }),
  },
};

/* ─────────────────────────── اکانت ─────────────────────────── */

/* ⚠️ `following` و `posts` در دادهٔ واقعی `null` هستند — فقط `followers` مقدار دارد */
const accountAudienceSchema = obj({
  followers: count({ max: 1000000000, nullable: true }),
  following: count({ max: 1000000000, nullable: true }),
  posts: count({ max: 1000000000, nullable: true }),
  growth: num({ min: -1000000, max: 1000000, nullable: true }),
}, { allowUnknown: true });

export const mediaAccountSchema = {
  name: 'mediaAccount',
  collection: 'mediaAccounts',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaAccounts.json',
  description: 'اکانت/کانال زیر یک پلتفرم. یکتایی روی (platform, externalId).',
  fields: {
    id: required(id({ prefix: 'acc' })),
    platform: describe(required(enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' })), 'پلتفرم — باید در mediaPlatforms باشد'),
    name: required(str({ min: 1, max: 200, allowEmpty: false })),
    handle: str({ max: 120 }),
    /* ⚠️ externalId در دو پلتفرم مختلف می‌تواند یکی باشد (`@tapesh` در تلگرام و ایتا).
       پس یکتایی درست، ترکیبی است: (platform + externalId). */
    externalId: describe(str({ max: 200 }), 'شناسهٔ بیرونی — یکتا فقط در محدودهٔ همان پلتفرم'),
    internalId: describe(required(str({ min: 1, max: 120, allowEmpty: false })), 'شناسهٔ داخلی — یکتا در کل مجموعه'),
    kind: enumOf(MEDIA_ACCOUNT_KINDS, { name: 'MEDIA_ACCOUNT_KINDS' }),
    url: str({ max: 600 }),
    avatar: str({ max: 600 }),
    description: str({ max: 2000 }),
    isActive: bool(),
    managerId: ref('mediaTeam', { nullable: true }),
    memberIds: arr(ref('mediaTeam'), { max: 40, unique: true }),
    audience: accountAudienceSchema,
    metrics: { ...json(), nullable: true },
    lastSyncAt: { ...timestamp(), nullable: true },
    lastSyncStatus: { ...str({ max: 40 }), nullable: true },
    lastSyncMessage: str({ max: 600 }),
    /* اتصال اختیاری به کانال انتشار — فعلاً در همهٔ رکوردها null است */
    publishChannelId: ref('publishChannels', { nullable: true }),
    seed: bool(),
    startedAt: describe(timestamp({ dateOnly: true, nullable: true }), 'تاریخ شروع فعالیت'),
    lastActivityAt: timestamp(),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
    createdBy: serverOnly(str({ max: 80 })),
    createdByName: str({ max: 120 }),
  },
  unique: [
    { fields: ['internalId'] },
    { fields: ['platform', 'externalId'] },
  ],
};

/* ─────────────────────────── محتوا ─────────────────────────── */

const mediaAssetRefSchema = obj({
  id: str({ max: 80 }),
  kind: enumOf(MEDIA_ASSET_KINDS, { name: 'MEDIA_ASSET_KINDS' }),
  url: str({ max: 600 }),
  mime: str({ max: 120 }),
  size: count({ max: 1024 * 1024 * 1024 }),
  name: str({ max: 300 }),
}, { allowUnknown: true });

/* ورودی تاریخچهٔ گردش کار — کلیدها از دادهٔ واقعی: at, byId, byName, from, to, action, note */
const mediaHistoryEntrySchema = obj({
  at: timestamp(),
  byId: str({ max: 80 }),
  byName: str({ max: 120 }),
  from: { ...enumOf(MEDIA_CONTENT_STATUSES, { name: 'MEDIA_CONTENT_STATUSES', nullable: true }), nullable: true },
  to: { ...enumOf(MEDIA_CONTENT_STATUSES, { name: 'MEDIA_CONTENT_STATUSES' }), nullable: true },
  action: describe(str({ max: 60 }), 'فعل گردش کار — مثل created / status-changed'),
  note: str({ max: 600 }),
}, { allowUnknown: true });

export const mediaContentSchema = {
  name: 'mediaContent',
  collection: 'mediaContents',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaContents.json',
  description: 'محتوای رسانه‌ای با گردش تأیید. وضعیت از ماشین وضعیت mediaStore تبعیت می‌کند.',
  fields: {
    id: required(id({ prefix: 'cnt' })),
    platform: describe(required(enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' })), 'پلتفرم'),
    accountId: describe(required(ref('mediaAccounts', { nullable: false })), 'اکانت — الزامی'),
    campaignId: describe(required(ref('mediaCampaigns', { nullable: false })), 'کمپین — الزامی'),
    authorId: describe(required(ref('mediaTeam', { nullable: false })), 'نویسنده — الزامی'),
    reviewerId: ref('mediaTeam', { nullable: true }),
    title: str({ max: 300 }),
    caption: str({ max: 8000, trim: false }),
    cta: describe(str({ max: 600 }), 'فراخوان به اقدام (CTA)'),
    contentType: enumOf(MEDIA_CONTENT_TYPES, { name: 'MEDIA_CONTENT_TYPES' }),
    status: describe(required(enumOf(MEDIA_CONTENT_STATUSES, { name: 'MEDIA_CONTENT_STATUSES' })), 'وضعیت گردش تأیید'),
    scheduledAt: { ...timestamp(), nullable: true },
    publishedAt: { ...timestamp(), nullable: true },
    timezone: describe(str({ max: 60 }), 'منطقهٔ زمانی زمان‌بندی — مثل Asia/Tehran'),
    thumbnail: str({ max: 600 }),
    assets: arr(mediaAssetRefSchema, { max: 20 }),
    hashtags: strArray({ max: 30 }),
    mentions: strArray({ max: 30 }),
    links: strArray({ max: 30 }),
    tagIds: arr(ref('mediaTags'), { max: 20, unique: true }),
    utmId: ref('mediaUtm', { nullable: true }),
    metrics: { ...json(), nullable: true },
    publishResult: { ...json(), nullable: true },
    rejection: { ...json(), nullable: true },
    notes: str({ max: 4000 }),
    history: arr(mediaHistoryEntrySchema, { max: 200 }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
    createdBy: serverOnly(str({ max: 80 })),
    createdByName: str({ max: 120 }),
  },
  transitions: { field: 'status', machine: 'MEDIA_CONTENT' },
  transitionTables: { MEDIA_CONTENT: MEDIA_CONTENT_TRANSITIONS },
  crossField: ['mediaContentPublishedAt', 'mediaContentScheduledAt'],
};

/* ─────────────────────────── کمپین ─────────────────────────── */

export const mediaCampaignSchema = {
  name: 'mediaCampaign',
  collection: 'mediaCampaigns',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaCampaigns.json',
  description: 'کمپین رسانه‌ای. بازهٔ تاریخ و بودجه قید عددی دارند.',
  fields: {
    id: required(id({ prefix: 'cmp' })),
    name: required(str({ min: 1, max: 200, allowEmpty: false })),
    goal: str({ max: 1000 }),
    description: str({ max: 2000 }),
    status: describe(required(enumOf(MEDIA_CAMPAIGN_STATUSES, { name: 'MEDIA_CAMPAIGN_STATUSES' })), 'وضعیت کمپین'),
    startAt: describe(timestamp({ dateOnly: true, nullable: true }), 'شروع'),
    endAt: describe(timestamp({ dateOnly: true, nullable: true }), 'پایان'),
    budget: describe(num({ min: 0, max: 1e12 }), 'بودجه — نامنفی'),
    ownerId: describe(required(ref('mediaTeam', { nullable: false })), 'مالک — الزامی'),
    platformIds: arr(ref('mediaPlatforms'), { max: 20, unique: true }),
    tagIds: arr(ref('mediaTags'), { max: 30, unique: true }),
    utmId: ref('mediaUtm', { nullable: true }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
    updatedBy: serverOnly(str({ max: 80 })),
    createdByName: str({ max: 120 }),
  },
  crossField: ['mediaCampaignDateRange'],
};

/* ─────────────────────────── تیم ─────────────────────────── */

export const mediaTeamSchema = {
  name: 'mediaTeam',
  collection: 'mediaTeam',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaTeam.json',
  description: 'عضو تیم رسانه. اتصال به حساب مدیر اختیاری است.',
  fields: {
    id: required(id({ prefix: 'tm' })),
    name: required(str({ min: 1, max: 200, allowEmpty: false })),
    role: describe(required(enumOf(MEDIA_TEAM_ROLES, { name: 'MEDIA_TEAM_ROLES' })), 'نقش در تیم رسانه'),
    responsibility: str({ max: 600 }),
    avatar: str({ max: 600 }),
    email: str({ max: 190 }),
    phone: str({ max: 40 }),
    platformIds: arr(ref('mediaPlatforms'), { max: 20, unique: true }),
    campaignIds: arr(ref('mediaCampaigns'), { max: 100, unique: true }),
    /* اتصال اختیاری به حساب مدیر پنل — فعلاً در همهٔ رکوردها null است */
    adminId: ref('admins', { nullable: true }),
    isActive: bool(),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
    createdBy: serverOnly(str({ max: 80 })),
  },
};

/* ─────────────────────────── برچسب ─────────────────────────── */

export const mediaTagSchema = {
  name: 'mediaTag',
  collection: 'mediaTags',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaTags.json',
  description: 'هشتگ یا موضوع. یکتایی روی (kind + slug) — همان برچسب در دو نوع مجاز است.',
  fields: {
    id: required(id({ prefix: 'tag' })),
    label: required(str({ min: 1, max: 200, allowEmpty: false })),
    slug: describe(required(str({ min: 1, max: 200, allowEmpty: false })), 'شناسهٔ نرمال‌شده — یکتا در محدودهٔ kind'),
    kind: describe(required(enumOf(MEDIA_TAG_KINDS, { name: 'MEDIA_TAG_KINDS' })), 'نوع — بخشی از کلید یکتایی'),
    /* رنگ در دادهٔ واقعی می‌تواند رشتهٔ خالی باشد */
    color: describe({ ...hexColor(), nullable: true }, 'رنگ برچسب — hex یا خالی'),
    description: str({ max: 1000 }),
    usageCount: count({ max: 10000000 }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
  },
  /* ⚠️ یکتایی `slug` تنها نادرست است: «فیزیولوژی» هم به‌عنوان topic و هم
     hashtag وجود دارد. کلید درست ترکیبی است. */
  unique: [{ fields: ['kind', 'slug'] }],
};

/* ─────────────────────────── سنجه ─────────────────────────── */

/** سنجه‌های عددی روزانه — همه نامنفی. */
const METRIC_FIELDS = [
  'followers', 'following', 'posts', 'reach', 'impressions', 'views', 'likes',
  'comments', 'shares', 'saves', 'clicks', 'websiteClicks', 'engagement', 'signups', 'purchases',
];

export const mediaMetricSchema = {
  name: 'mediaMetric',
  collection: 'mediaMetrics',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaMetrics.json',
  description: 'عکس لحظه‌ای سنجه‌ها به تفکیک روز و اکانت. پرحجم‌ترین مجموعه.',
  fields: {
    id: describe(required(id({ prefix: 'mtr' })), 'شناسهٔ سنجه — پیشوند mtr'),
    accountId: describe(required(ref('mediaAccounts', { nullable: false })), 'اکانت — الزامی'),
    platform: enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' }),
    date: describe(required(timestamp({ dateOnly: true })), 'روز سنجه'),
    source: describe(str({ max: 40 }), 'منبع سنجه — `seed` برای دادهٔ نمونه'),
    /* `followers`/`following` فقط در بخشی از رکوردها هستند (سنجهٔ سطح اکانت) */
    followers: { ...count({ max: 1000000000 }), nullable: true },
    following: { ...count({ max: 1000000000 }), nullable: true },
    ...Object.fromEntries(METRIC_FIELDS.filter((f) => f !== 'followers' && f !== 'following')
      .map((f) => [f, count({ max: 1000000000 })])),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
  },
  unique: [{ fields: ['accountId', 'date'] }],
};

/* ─────────────────────────── اینباکس ─────────────────────────── */

const inboxReplySchema = obj({
  id: str({ max: 80 }),
  text: str({ max: 4000, trim: false }),
  at: timestamp(),
  by: str({ max: 80 }),
  byName: str({ max: 120 }),
}, { allowUnknown: true });

export const mediaInboxSchema = {
  name: 'mediaInbox',
  collection: 'mediaInbox',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaInbox.json',
  description: 'پیام و تعامل ورودی. ارجاع به محتوا الزامی است.',
  fields: {
    id: describe(required(id({ prefix: 'inb' })), 'شناسهٔ پیام — پیشوند inb'),
    platform: enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' }),
    accountId: describe(required(ref('mediaAccounts', { nullable: false })), 'اکانت — الزامی'),
    contentId: describe(required(ref('mediaContents', { nullable: false })), 'محتوای مرتبط — الزامی'),
    kind: describe(required(enumOf(MEDIA_INBOX_KINDS, { name: 'MEDIA_INBOX_KINDS' })), 'نوع تعامل'),
    status: describe(required(enumOf(MEDIA_INBOX_STATUSES, { name: 'MEDIA_INBOX_STATUSES' })), 'وضعیت رسیدگی'),
    authorName: str({ max: 200 }),
    authorHandle: str({ max: 200 }),
    authorAvatar: str({ max: 600 }),
    text: str({ max: 8000, trim: false }),
    at: timestamp(),
    url: str({ max: 600 }),
    replies: arr(inboxReplySchema, { max: 100, uniqueBy: 'id' }),
    tags: strArray({ max: 20 }),
    assignedToId: ref('mediaTeam', { nullable: true }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
  },
};

/* ─────────────────────────── رصد ─────────────────────────── */

export const mediaMentionSchema = {
  name: 'mediaMention',
  collection: 'mediaMentions',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaMentions.json',
  description: 'رصد نام و کلیدواژه. کلیدواژه به برچسب موجود وصل است.',
  fields: {
    id: required(id({ prefix: 'mnt' })),
    platform: enumOf(MEDIA_PLATFORMS, { name: 'MEDIA_PLATFORMS' }),
    keywordId: describe(required(ref('mediaTags', { nullable: false })), 'برچسب کلیدواژه — الزامی'),
    keywordLabel: str({ max: 200 }),
    authorName: str({ max: 200 }),
    authorHandle: str({ max: 200 }),
    text: str({ max: 8000, trim: false }),
    at: timestamp(),
    reach: count({ max: 1000000000 }),
    sentiment: enumOf(MEDIA_MENTION_SENTIMENTS, { name: 'MEDIA_MENTION_SENTIMENTS' }),
    handled: bool(),
    url: str({ max: 600 }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
  },
};

/* ─────────────────────────── اعلان ─────────────────────────── */

/**
 * اعلان داخلی مرکز رسانه.
 * ⚠️ `entityId` **چندریختی** است: بسته به `entityType` به `mediaContents` یا
 * `mediaCampaigns` اشاره می‌کند، و دو مقدار ویژهٔ `failed-queue` و
 * `review-queue` هم دارد که به هیچ رکوردی وصل نیستند (نشانگر صف).
 * پس ارجاع این فیلد «نرم» است و نبودِ والد فقط هشدار می‌دهد.
 */
export const mediaNotificationSchema = {
  name: 'mediaNotification',
  collection: 'mediaNotifications',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaNotifications.json',
  description: 'اعلان داخلی — ارجاع چندریختی و نرم به محتوا/کمپین یا نشانگر صف.',
  fields: {
    id: required(id({ prefix: 'ntf' })),
    kind: describe(required(enumOf(MEDIA_NOTIFICATION_KINDS, { name: 'MEDIA_NOTIFICATION_KINDS' })), 'نوع اعلان'),
    level: describe(required(enumOf(MEDIA_NOTIFICATION_LEVELS, { name: 'MEDIA_NOTIFICATION_LEVELS' })), 'سطح'),
    title: str({ max: 300 }),
    body: str({ max: 2000, trim: false }),
    entityType: describe(required(enumOf(MEDIA_ENTITY_TYPES, { name: 'MEDIA_ENTITY_TYPES' })), 'نوع موجودیت مرجع'),
    entityId: describe(
      str({ max: 120 }),
      'شناسهٔ مرجع — چندریختی؛ می‌تواند نشانگر صف باشد',
    ),
    link: { ...str({ max: 600 }), nullable: true },
    isRead: bool(),
    isArchived: bool(),
    at: timestamp(),
  },
  /** ارجاع چندریختی — در اسکنر جداگانه و به‌صورت نرم بررسی می‌شود */
  polymorphicRefs: [{
    field: 'entityId',
    byField: 'entityType',
    map: { 'media-content': 'mediaContents', 'media-campaign': 'mediaCampaigns' },
    sentinels: ['failed-queue', 'review-queue'],
    soft: true,
  }],
};

/* ─────────────────────────── UTM ─────────────────────────── */

export const mediaUtmSchema = {
  name: 'mediaUtm',
  collection: 'mediaUtm',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaUtm.json',
  description: 'لینک UTM ساخته‌شده. قید: campaignId و contentId باید موجود باشند.',
  fields: {
    id: required(id({ prefix: 'utm' })),
    label: str({ max: 300 }),
    baseUrl: str({ max: 600 }),
    url: describe(required(str({ min: 1, max: 1200, allowEmpty: false })), 'لینک نهایی با پارامترهای UTM'),
    source: str({ max: 120 }),
    medium: enumOf(MEDIA_UTM_MEDIUMS, { name: 'MEDIA_UTM_MEDIUMS' }),
    campaign: str({ max: 300 }),
    campaignId: describe(required(ref('mediaCampaigns', { nullable: false })), 'کمپین — الزامی'),
    content: str({ max: 300 }),
    contentId: describe(required(ref('mediaContents', { nullable: false })), 'محتوا — الزامی'),
    term: str({ max: 200 }),
    visits: count({ max: 1000000000 }),
    clicks: count({ max: 1000000000 }),
    signups: count({ max: 1000000000 }),
    purchases: count({ max: 1000000000 }),
    seed: bool(),
    createdAt: serverOnly(timestamp()),
    createdByName: str({ max: 120 }),
  },
};

/* ─────────────────────────── فرادادهٔ مرکز رسانه ─────────────────────────── */

export const mediaMetaSchema = {
  name: 'mediaMeta',
  collection: 'mediaMeta',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/mediaMeta.json',
  description: 'فرادادهٔ خود مرکز رسانه — نسخهٔ seed و وضعیت دادهٔ نمونه. تک‌رکوردی.',
  singletonId: 'meta',
  fields: {
    id: describe(required(str({ max: 40, allowEmpty: false })), 'همیشه `meta`'),
    seededAt: timestamp(),
    seedVersion: describe(num({ min: 1, max: 1000, int: true }), 'نسخهٔ seed — افزایشش دادهٔ نمونه را بازتولید می‌کند'),
    demo: describe(bool(), 'محیط دمو است؟'),
    updatedAt: serverOnly(timestamp()),
  },
};

export const MEDIA_SCHEMAS = [
  mediaPlatformSchema, mediaAccountSchema, mediaContentSchema, mediaCampaignSchema,
  mediaTeamSchema, mediaTagSchema, mediaMetricSchema, mediaInboxSchema,
  mediaMentionSchema, mediaNotificationSchema, mediaUtmSchema, mediaMetaSchema,
];

export { METRIC_FIELDS };
